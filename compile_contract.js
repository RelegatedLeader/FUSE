import solc from 'solc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function compileContract() {
  console.log('🔨 Compiling UserDataStorage contract...');

  // Read the contract source
  const contractPath = path.join(__dirname, 'contracts', 'UserDataStorage.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  // Prepare input for solc
  const input = {
    language: 'Solidity',
    sources: {
      'UserDataStorage.sol': {
        content: source,
      },
    },
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
    },
  };

  // Compile
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  // Check for errors
  if (output.errors) {
    const errors = output.errors.filter(error => error.severity === 'error');
    if (errors.length > 0) {
      console.error('❌ Compilation errors:');
      errors.forEach(error => console.error(error.formattedMessage));
      process.exit(1);
    }
  }

  // Extract bytecode and ABI
  const contract = output.contracts['UserDataStorage.sol']['UserDataStorage'];
  const bytecode = contract.evm.bytecode.object;
  const abi = contract.abi;

  // Create artifacts directory if it doesn't exist
  const artifactsDir = path.join(__dirname, 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir);
  }

  // Write artifacts
  const artifacts = {
    bytecode: bytecode,
    abi: abi,
  };

  fs.writeFileSync(
    path.join(artifactsDir, 'UserDataStorage.json'),
    JSON.stringify(artifacts, null, 2)
  );

  console.log('✅ Contract compiled successfully!');
  console.log('📁 Artifacts saved to artifacts/UserDataStorage.json');
}

compileContract();