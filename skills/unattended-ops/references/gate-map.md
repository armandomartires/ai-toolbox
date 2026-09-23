# Building a gate command map

The gate map is the binding's, not this skill's — every command in it is
project-specific. What is **not** the binding's is the shape it must have.
These are construction rules; each one exists because its absence was
observed producing a green result that meant nothing.

## Where it lives and who reads it

The map lives in the **binding**, keyed by task kind, and the **driver**
invokes it from its own shell. No agent in the run is ever handed a
verification command string (rule 2). The `gate-runner` receives the
evidence and writes it to the run's evidence file; it does not compose,
correct or choose a command.

A gate command taken from the task file being verified is the failure rule 2
exists to prevent, and it is not a hypothetical: **29 scripts** in one
project exit 0 silently without a `-Run` guard, **3 more** hang on a
mandatory parameter with no TTY, and several task files' Verification blocks
omit exactly those switches (`references/five-rules.md`).

## Rule A — the list is role-blind

**Run the same gate set regardless of which part of the system the task
touched.**

A `ui` module was committed having only ever compiled the `data` workbook.
It happened to be clean; that was luck. The defect is not the missing entry —
it is that a map keyed by *what this task touched* has an entry to be missing
in the first place, and the missing entry is by definition the one nobody
noticed.

The cost is real and is accepted knowingly: a role-blind list runs gates that
cannot fail for this task. That is what rule 3's batching is for. **Paying
minutes beats reasoning about coverage at 3am with nobody watching.**

`A120` is the worked example. A role map missing one entry made a gate exit 1
on an **untouched tree**, so it checked nothing at all, for **two stages** —
and two stages of green gates went past without anyone noticing.

## Rule B — the list is content-blind

**Never filter the gate set by file extension.**

A form-like component passed every gate **unread**: the gate list selected
files by extension, the component's files did not match, the gates ran, exited
0, and had opened none of the files the task changed. An exit code from a gate
that read nothing is the most expensive kind of green, because it is
indistinguishable from the real thing at every later point.

## Rule C — every entry states what it proves, and what it does not

A gate that "runs the tests" is not an entry. An entry names the command, the
working directory, the switches that make it actually do work, the expected
exit code, **and the figure it produces** — because the figure is what a task
file's acceptance criteria will want, and `references/evidence.md` forbids any
figure that did not come out of the evidence file.

A gate that produces no figure says so. That is a legitimate entry; a silent
one is not.

## Rule D — three outcomes, not two

**PASS, FAIL and SKIP are distinct, and a SKIP is not a pass.** This repo's
own `tests/smoke-mcp.sh` already reports them as three outcomes for the same
reason. A gate that could not run has told you nothing about the work, and an
adjudicator that reads a skip as a pass has been handed an invention.

## Rule E — the switches that make a script lie are part of the entry

Enumerate, per command:

- the switch without which it **exits 0 having done nothing** (the `-Run`
  class: 29 instances in one project);
- the parameter without which it **prompts and hangs** with no TTY (3 more);
- anything that changes its exit code without changing its work.

If a command's silent-no-op switch is not known, the entry's slot reads
`unknown` — and `unknown` is a stop (`templates/binding.md`). Do not guess a
switch from a script's name.

## Rule F — long gates are not in the per-task map

Anything that cannot finish inside the client's shell-call cap belongs in the
**batched** set, run once per group the run actually touched, after the cycle.
`references/long-gates.md`.

## What the map may never do

- **Read a command from the task file.** Rule 2.
- **Let an agent edit, extend or "correct" an entry.** A run that can widen
  its own verification has no verification.
- **Grow an entry that only runs when a condition holds**, unless the
  condition is the task *kind* the map is keyed by. A conditional gate is a
  role-blind list with rule A quietly removed.
