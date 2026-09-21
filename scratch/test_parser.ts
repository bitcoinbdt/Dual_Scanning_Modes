import { parseSourceFiles, fetchContractSource } from '../lib/blockchain/contractSourceService';

console.log("=== UNIT TEST: Contract Source Parser ===");

// 1. Test single file parsing
const singleSol = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract TestToken {
    string public name = "Test";
}
`;
const singleResult = parseSourceFiles(singleSol, "TestToken");
console.log("1. Single file test:", singleResult.length === 1 && singleResult[0].fileName === "TestToken.sol" ? "PASSED" : "FAILED");
console.log("   File:", singleResult[0].fileName);

// 2. Test standard JSON input with double braces {{sources: {...}}}
const standardJsonDoubleBrace = JSON.stringify({
  language: "Solidity",
  sources: {
    "contracts/Token.sol": {
      content: "pragma solidity ^0.8.0;\nimport './IERC20.sol';\ncontract Token {}"
    },
    "contracts/IERC20.sol": {
      content: "pragma solidity ^0.8.0;\ninterface IERC20 {}"
    }
  }
});
const doubleBraceInput = "{" + standardJsonDoubleBrace + "}";
const multiResult1 = parseSourceFiles(doubleBraceInput, "Token");
console.log("2. Double-brace Standard JSON test:", multiResult1.length === 2 ? "PASSED" : "FAILED");
console.log("   Files extracted:", multiResult1.map(f => f.fileName).join(", "));

// 3. Test standard JSON input with single braces {sources: {...}}
const multiResult2 = parseSourceFiles(standardJsonDoubleBrace, "Token");
console.log("3. Single-brace Standard JSON test:", multiResult2.length === 2 ? "PASSED" : "FAILED");
console.log("   Files extracted:", multiResult2.map(f => f.fileName).join(", "));

// 4. Test Solana / Non-EVM address rejection
async function testRejection() {
  const res = await fetchContractSource("So11111111111111111111111111111111111111112", "solana");
  console.log("4. Solana address rejection test:", res === null ? "PASSED" : "FAILED");
}

testRejection().then(() => {
  console.log("\n=== ALL PARSER UNIT TESTS FINISHED ===");
});