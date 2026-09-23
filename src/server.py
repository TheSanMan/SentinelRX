import sys
import os
import structlog
from contextlib import contextmanager

# === STDOUT GUARD ===
# We must ensure absolutely no text goes to stdout during import/init
# because it breaks the MCP JSON-RPC protocol.

@contextmanager
def suppress_stdout():
    """Temporarily redirect stdout to devnull."""
    with open(os.devnull, "w") as devnull:
        old_stdout = sys.stdout
        sys.stdout = devnull
        try:
            yield
        finally:
            sys.stdout = old_stdout

# Start suppressing immediately
# We will only restore it inside run_mcp_server()
stdout_silencer = suppress_stdout()
stdout_silencer.__enter__()

# Configure structlog to use stderr
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
)

from mcp.server.fastmcp import FastMCP
from src.tools.drug_tools import (
    lookup_drug,
    get_drug_info,
    check_interactions,
    get_food_interactions_for_drug,
    scan_label,
)

# Server instructions
INSTRUCTIONS = """
SentinelRx is a drug safety and interaction checking service.
... (truncated for brevity)
"""

mcp = FastMCP(
    name="SentinelRx",
    instructions=INSTRUCTIONS,
    dependencies=["mcp", "Pillow", "structlog", "httpx", "lxml", "rapidfuzz"],
)
logger = structlog.get_logger()

# Register drug tools
mcp.tool()(lookup_drug)
mcp.tool()(get_drug_info)
mcp.tool()(check_interactions)
mcp.tool()(get_food_interactions_for_drug)
mcp.tool()(scan_label)


@mcp.tool()
async def health_check() -> str:
    """Basic health check to verify server is running."""
    return "SentinelRx MCP Server is active."



def run_mcp_server() -> None:
    """
    Run the MCP server.

    This function can be called from api.py to start the MCP server
    in a background thread, or run directly as the main entry point.
    """
    # CRITICAL: Restore stdout before running MCP!
    # Otherwise the MCP server cannot answer.
    try:
        stdout_silencer.__exit__(None, None, None)
    except:
        pass

    logger.info("Starting MCP server...")
    mcp.run()



def main() -> None:
    """Entry point when run as a standalone script."""
    run_mcp_server()


if __name__ == "__main__":
    main()
