def test_echo():
    from template_mcp_server.server import echo
    assert echo("hi") == "hi"
