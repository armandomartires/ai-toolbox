"""Template MCP server. One tool per concern, strict schemas, clear errors."""
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("template-mcp-server")


@mcp.tool()
def echo(text: str) -> str:
    """Echo the input text back.

    Args:
        text: The text to echo.
    """
    return text


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
