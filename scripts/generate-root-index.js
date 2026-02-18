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
  
  // Calculate audit data
  const largestFiles = [...allFiles].sort((a, b) => b.size - a.size).slice(0, 50);
  const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
  
  // Group by file type
  const byExtension = {};
  allFiles.forEach(file => {
    const ext = path.extname(file.name) || 'no-extension';
    if (!byExtension[ext]) {
      byExtension[ext] = { count: 0, size: 0 };
    }
    byExtension[ext].count++;
    byExtension[ext].size += file.size;
  });
  
  const extensionStats = Object.entries(byExtension)
    .map(([ext, data]) => ({ ext, ...data }))
    .sort((a, b) => b.size - a.size);
  
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
  
  // Generate audit section
  const largestFilesRows = largestFiles.map(file => {
    const fileName = file.name.substring(file.name.lastIndexOf('/') + 1);
    const url = '/' + file.name;
    const extension = path.extname(file.name);
    return `<tr><td><a href="${url}">${file.name}</a></td><td>${formatFileSize(file.size)}</td><td>${extension || 'n/a'}</td></tr>`;
  }).join('\n');
  
  const extensionStatsRows = extensionStats.map(stat => {
    const percent = ((stat.size / totalSize) * 100).toFixed(1);
    return `<tr><td>${stat.ext || '(no extension)'}</td><td>${stat.count}</td><td>${formatFileSize(stat.size)}</td><td>${percent}%</td></tr>`;
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
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            margin-bottom: 10px;
            color: #333;
        }
        h2 {
            margin-top: 30px;
            margin-bottom: 15px;
            color: #444;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 8px;
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
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-card .label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .stat-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
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
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .section-separator {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 3px solid #ddd;
        }
    </style>
</head>
<body>
    <h1>🦕 Doge Minna Assets</h1>
    <div class="info">
        <strong>Complete File Index & Assets Audit</strong> - All files are listed below with a comprehensive size audit. This index is auto-generated and updated on each deploy.
    </div>
    
    <div class="quick-links">
        <a href="#audit">📊 Assets Audit</a>
        <a href="#files">📋 Complete File List</a>
        <a href="/models/">🎨 Models</a>
        <a href="/music/">🎵 Music</a>
        <a href="/sfx/">🔊 Sound Effects</a>
        <a href="/textures/">🧵 Textures</a>
        <a href="/worlds/">🌍 Worlds</a>
        <a href="/manifests/">📦 Manifests</a>
    </div>
    
    <div id="audit" class="section-separator">
        <h2>📊 Assets Audit</h2>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="label">Total Files</div>
                <div class="value">${allFiles.length}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Size</div>
                <div class="value">${formatFileSize(totalSize)}</div>
            </div>
            <div class="stat-card">
                <div class="label">Average File</div>
                <div class="value">${formatFileSize(Math.round(totalSize / allFiles.length))}</div>
            </div>
            <div class="stat-card">
                <div class="label">Largest File</div>
                <div class="value">${largestFiles.length > 0 ? formatFileSize(largestFiles[0].size) : 'N/A'}</div>
            </div>
        </div>
        
        <h3>🔴 Largest Files (Top 50)</h3>
        <p style="color: #666; font-size: 14px;">Consider optimizing these files if they're larger than necessary.</p>
        <table>
            <thead>
                <tr>
                    <th>File Path</th>
                    <th>Size</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                ${largestFilesRows}
            </tbody>
        </table>
        
        <h3>📂 File Type Breakdown</h3>
        <table>
            <thead>
                <tr>
                    <th>Extension</th>
                    <th>Count</th>
                    <th>Total Size</th>
                    <th>% of Total</th>
                </tr>
            </thead>
            <tbody>
                ${extensionStatsRows}
            </tbody>
        </table>
    </div>
    
    <div id="files" class="section-separator">
        <h2>📋 Complete File List</h2>
        
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
    </div>
</body>
</html>`;

  return html;
}

// Generate root index
const rootIndex = generateRootIndex();
fs.writeFileSync('index.html', rootIndex);
console.log('✓ Generated comprehensive root index.html');
