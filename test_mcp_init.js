const { spawn } = require('child_process');

console.log("-> Starting MCP Server process...");
const mcpProcess = spawn('/opt/homebrew/bin/npx', ['-y', '@shopify/dev-mcp@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env 
});

mcpProcess.stderr.on('data', (data) => {
  // StdErr is often used for logging by MCP servers
  console.log(`[STDERR] ${data.toString().trim()}`);
});

let buffer = '';
mcpProcess.stdout.on('data', (data) => {
  const output = data.toString();
  // We log raw stdout because MCP messages are JSON-RPC over stdout
  console.log(`[STDOUT RAW] ${output.trim()}`);
  
  // Try to parse to see if it's our response
  buffer += output;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep remainder in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        console.log("\n✅ SUCCESS: Server responded to 'initialize'!");
        if (msg.error) {
            console.log("Initialization Error:", JSON.stringify(msg.error, null, 2));
        } else {
            console.log("Server Capabilities:", JSON.stringify(msg.result?.capabilities, null, 2));
            console.log("\n-> Requesting tools list...");
            
            // Now ask for tools
            const toolsPayload = {
              jsonrpc: "2.0",
              id: 2,
              method: "tools/list",
              params: {}
            };
            mcpProcess.stdin.write(JSON.stringify(toolsPayload) + '\n');
        }
      } else if (msg.id === 2) {
        console.log("\n✅ SUCCESS: Server provided tools!");
        console.log("Available Tools:", JSON.stringify(msg.result?.tools || {}, null, 2));
        setTimeout(() => process.exit(0), 1000);
      }
    } catch(e) {
      // Ignored: Not standard JSON-RPC stdout lines (like boot logs)
    }
  }
});

mcpProcess.on('error', (err) => {
  console.error('-> Failed to start process:', err);
});

mcpProcess.on('close', (code) => {
  console.log(`-> Process exited with code ${code}`);
});

// Wait a bit before sending payload to give `npx` time to boot the actual package
setTimeout(() => {
  const initPayload = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
    }
  };
  
  console.log("-> Sending 'initialize' request...");
  mcpProcess.stdin.write(JSON.stringify(initPayload) + '\n');
  
  // Also send initialized notification right after
  mcpProcess.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  }) + '\n');
  
}, 3000);
