export const excludePatterns = new Set([
  /^\.git$/, // Git directory
  /^\.gitignore$/, // Git ignore file
  /^\.svn$/, // SVN directory
  /^node_modules$/, // Node.js dependencies
  /^\.env*/, // Environment files
  /^\.vscode$/, // VS Code settings
  /^\.idea$/, // IntelliJ settings
  /^logs?$/, // Log directories
  /^dist$/, // Build output
  /^build$/, // Build output
  /^coverage$/, // Test coverage
  /^\.DS_Store$/, // macOS system files
  /^__pycache__$/, // Python cache
  /^\.pytest_cache$/, // Python test cache
  /^\.mypy_cache$/, // Python type checking cache
  /^\.tox$/, // Python testing automation
  /^venv$/, // Python virtual environment
  /^\.venv$/, // Alternative Python virtual environment
  /^\.artifacts$/, // Solidity compilation artifacts
  /^\.cache$/, // General cache directory
  /^cache$/, // Alternative cache directory
  /^artifacts$/, // Smart contract artifacts
  /^typechain$/, // TypeChain generated files
  /^\.hardhat$/, // Hardhat files
  /^\.truffle$/, // Truffle files
  /^\.brownie$/, // Brownie files
  /^\.coverage_artifacts$/, // Smart contract coverage artifacts
  /^\.coverage_cache$/, // Coverage cache
  /^\.solcover$/, // Solidity coverage
  /^\.openzeppelin$/, // OpenZeppelin
  /^\.deps$/, // Dependencies
  /^\.tmp$/, // Temporary files
  /^tmp$/, // Alternative temporary files
  /^\.history$/, // VS Code history plugin
  /^\.next$/, // Next.js build output
  /^out$/, // Generic build output
  /^output$/, // Generic build output
  /^\.bin$/, // Binary files
  /^bin$/, // Alternative binary files
  /^__snapshots__$/, // Jest snapshots
  /^package-lock\.json$/, // Node lock file
  /^bun\.lockb$/, // Bun lock file
  /^pnpm-lock\.yaml$/, // PNPM lock file
  /^yarn\.lock$/, // Yarn lock file
  /\.(?:woff2?|ttf|otf|eot)$/i, // font files
  /\.(?:jpe?g|png|gif|svg|webp|ico|avif|tiff?)$/i, // image files
  /\.(?:mp4|mov|avi|mkv|webm)$/i, // Exclude videos and .exe files
]);
