const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, baseUrl = '') {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip hidden files and .git
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      
      const fullPath = path.join(dirPath, entry.name);
      const relativeUrl = path.join(baseUrl, entry.name).replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = getAllFiles(fullPath, relativeUrl);
        files.push(...subFiles);
      } else {
        // Skip index.html files except root
        if (entry.name === 'index.html' && baseUrl !== '') {
          continue;
        }
        files.push({
          name: relativeUrl,
          isFile: true,
          size: fs.statSync(fullPath).size
        });
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err.message);
  }
  
  return files;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function generateRootIndex() {
  const allFiles = getAllFiles('.').sort((a, b) => a.name.localeCompare(b.name));
  
  // Group files by directory
  const grouped = {};
  allFiles.forEach(file => {
    const dir = file.name.substring(0, file.name.lastIndexOf('/')) || 'root';
    if (!grouped[dir]) {
      grouped[dir] = [];
    }
    grouped[dir].push(file);
  });
  
  // Generate file rows
  const fileRows = Object.keys(grouped).sort().map(dir => {
    const files = grouped[dir];
    const dirHeader = `<tr style="background: #e8f4f8;"><td colspan="3" style="font-weight: bold; padding: 12px;">${dir}/</td></tr>`;
    const fileRows = files.map(file => {
      const fileName = file.name.substring(file.name.lastIndexOf('/') + 1);
      const url = '/' + file.name;
      return `<tr><td>📄</td><td><a href="${url}">${fileName}</a></td><td>${formatFileSize(file.size)}</td></tr>`;
    }).join('\n');
    return dirHeader + '\n' + fileRows;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doge Minna Assets - Complete File Index</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            max-width: 1000px;
            margin: 0 auto;
        }
        h1 {
            margin-bottom: 10px;
            color: #333;
        }
        .info {
            background: #f0f0f0;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #666;
        }
        .quick-links {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .quick-links a {
            padding: 8px 12px;
            background: #0066cc;
            color: white;
            border-radius: 4px;
            text-decoration: none;
            font-size: 14px;
        }
        .quick-links a:hover {
            background: #0052a3;
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
            position: sticky;
            top: 0;
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
        .file-count {
            color: #666;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>🦕 Doge Minna Assets</h1>
    <div class="info">
        <strong>Complete File Index</strong> - All files in the repository are listed below. This index is auto-generated and updated on each deploy.
    </div>
    
    <div class="quick-links">
        <a href="/assets/">📁 Asset Directory</a>
        <a href="/assets/manifests/">📋 Manifests</a>
        <a href="/assets/models/">🎨 Models</a>
        <a href="/assets/music/">🎵 Music</a>
        <a href="/assets/sfx/">🔊 Sound Effects</a>
    </div>
    
    <table>
        <thead>
            <tr>
                <th></th>
                <th>File Path</th>
                <th>Size</th>
            </tr>
        </thead>
        <tbody>
            ${fileRows}
        </tbody>
    </table>
    
    <div class="file-count">
        <strong>Total Files:</strong> ${allFiles.length}
    </div>
</body>
</html>`;

  return html;
}

// Generate root index
const rootIndex = generateRootIndex();
fs.writeFileSync('index.html', rootIndex);
console.log('✓ Generated comprehensive root index.html');
