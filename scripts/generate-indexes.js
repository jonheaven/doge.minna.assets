const fs = require('fs');
const path = require('path');

const ROOT_DIR = '.';
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'scripts']);

function generateIndexForDirectory(dirPath, relativeUrl) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  
  files.sort((a, b) => {
    // Directories first, then files
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const fileRows = files
    .filter(f => f.name !== 'index.html' && !f.name.startsWith('.'))
    .map(f => {
      const isDir = f.isDirectory();
      const icon = isDir ? '📁' : '📄';
      const url = path.join(relativeUrl, f.name).replace(/\\/g, '/');
      const href = isDir ? url + '/' : url;
      return `<tr><td>${icon}</td><td><a href="${href}">${f.name}</a></td><td>${
        isDir ? '[DIR]' : 'file'
      }</td></tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Index of ${relativeUrl}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 {
            margin-bottom: 30px;
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th {
            background: #f9f9f9;
            border-bottom: 2px solid #ddd;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #555;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background: #f9f9f9;
        }
        a {
            color: #0066cc;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .parent {
            margin-bottom: 20px;
        }
        .parent a {
            padding: 8px 12px;
            background: #f0f0f0;
            border-radius: 4px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <h1>Index of ${relativeUrl}</h1>
    ${relativeUrl !== '/' ? '<div class="parent"><a href="../">↑ Parent Directory</a></div>' : ''}
    <table>
        <thead>
            <tr>
                <th></th>
                <th>Name</th>
                <th>Type</th>
            </tr>
        </thead>
        <tbody>
            ${fileRows}
        </tbody>
    </table>
</body>
</html>`;

  return html;
}

function walkDirectory(dirPath, baseUrl = '') {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  files.forEach(file => {
    if (file.name === 'index.html' || file.name.startsWith('.')) {
      return;
    }

    const fullPath = path.join(dirPath, file.name);
    const relativeUrl = path.join(baseUrl, file.name).replace(/\\/g, '/');

    if (file.isDirectory()) {
      // Generate index.html for this directory
      const indexPath = path.join(fullPath, 'index.html');
      const indexContent = generateIndexForDirectory(fullPath, '/' + relativeUrl);
      fs.writeFileSync(indexPath, indexContent);
      console.log(`✓ Generated index for /${relativeUrl}/`);

      // Recursively process subdirectories
      walkDirectory(fullPath, relativeUrl);
    }
  });
}

// Start walking from root directory for top-level folders
if (fs.existsSync(ROOT_DIR)) {
  console.log('Generating directory indexes...');

  const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
  entries.forEach((entry) => {
    if (!entry.isDirectory() || EXCLUDED_DIRS.has(entry.name)) return;
    if (entry.name.startsWith('.')) return;

    const fullPath = path.join(ROOT_DIR, entry.name);
    const relativeUrl = `/${entry.name}`;
    const indexPath = path.join(fullPath, 'index.html');
    const indexContent = generateIndexForDirectory(fullPath, relativeUrl);
    fs.writeFileSync(indexPath, indexContent);
    console.log(`✓ Generated index for ${relativeUrl}/`);

    walkDirectory(fullPath, entry.name);
  });

  console.log('✓ Directory indexes generated successfully');
} else {
  console.log(`Root directory not found at ${ROOT_DIR}`);
}
