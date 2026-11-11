"""A tiny YAML-subset reader for the CI files in this repo (no PyYAML).

Handles what .gitlab/ci/release.yml uses: block maps and lists, "- key: v"
list-of-maps, "|" block scalars, quoted and plain scalars, "[a, b]" flow lists,
full-line and trailing comments. It raises ValueError on anything it cannot
read (a tab, a line that is neither "key:" nor "- item"), so a structural
mistake fails loudly. It is not a general YAML parser.
"""
import re

KEY = re.compile(r'^("[^"]*"|\'[^\']*\'|[^\s:#"\'\[{-][^:]*?|-[^\s:][^:]*?):(?:\s+(.*))?$')


def _scalar(s):
    s = s.strip()
    if s[:1] in "\"'" and s[-1:] == s[:1] and len(s) > 1:
        return s[1:-1]
    s = re.sub(r"\s+#.*$", "", s)
    if s.startswith("[") and s.endswith("]"):
        inner = s[1:-1].strip()
        return [_scalar(x) for x in inner.split(",")] if inner else []
    return s


class _P:
    def __init__(self, text):
        if "\t" in text:
            raise ValueError("tab in YAML")
        self.lines = text.splitlines()
        self.i = 0

    def skip(self):
        while self.i < len(self.lines):
            t = self.lines[self.i].strip()
            if t and not t.startswith("#"):
                return
            self.i += 1

    def indent(self, line):
        return len(line) - len(line.lstrip(" "))

    def block_scalar(self, parent):
        out = []
        base = None
        while self.i < len(self.lines):
            ln = self.lines[self.i]
            if ln.strip() == "":
                out.append("")
                self.i += 1
                continue
            ind = self.indent(ln)
            if ind <= parent:
                break
            if base is None:
                base = ind
            out.append(ln[base:] if ind >= base else ln.strip())
            self.i += 1
        while out and out[-1] == "":
            out.pop()
        return "\n".join(out) + "\n"

    def value(self, rest, parent):
        rest = rest.strip() if rest else ""
        if rest in ("|", "|-", ">", ">-"):
            return self.block_scalar(parent)
        if rest == "":
            self.skip()
            if self.i < len(self.lines):
                ln = self.lines[self.i]
                ind = self.indent(ln)
                if ind > parent or (ind == parent and ln.lstrip().startswith("- ")):
                    return self.block(ind)
            return None
        return _scalar(rest)

    def block(self, ind):
        self.skip()
        if self.lines[self.i].lstrip().startswith("- "):
            return self.listing(ind)
        return self.mapping(ind)

    def listing(self, ind):
        items = []
        while True:
            self.skip()
            if self.i >= len(self.lines):
                break
            ln = self.lines[self.i]
            if self.indent(ln) != ind or not ln.lstrip().startswith("- "):
                break
            rest = ln.lstrip()[2:]
            if KEY.match(rest.strip()):
                self.lines[self.i] = " " * (ind + 2) + rest
                items.append(self.mapping(ind + 2))
            else:
                self.i += 1
                items.append(self.value_after_dash(rest, ind))
        return items

    def value_after_dash(self, rest, ind):
        rest = rest.strip()
        if rest in ("|", "|-", ">", ">-"):
            return self.block_scalar(ind)
        return _scalar(rest)

    def mapping(self, ind):
        m = {}
        while True:
            self.skip()
            if self.i >= len(self.lines):
                break
            ln = self.lines[self.i]
            if self.indent(ln) != ind:
                if self.indent(ln) > ind:
                    raise ValueError("unexpected indent at line %d: %r" % (self.i + 1, ln))
                break
            body = ln.strip()
            if body.startswith("- "):
                break
            k = KEY.match(body)
            if not k:
                raise ValueError("cannot read line %d: %r" % (self.i + 1, ln))
            self.i += 1
            m[_scalar(k.group(1))] = self.value(k.group(2), ind)
        return m


def load(path):
    with open(path, encoding="utf-8") as f:
        p = _P(f.read())
    p.skip()
    return p.mapping(p.indent(p.lines[p.i]))
