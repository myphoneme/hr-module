const fs = require('fs');
const path = require('path');

function getImageAsBase64(filename, folder) {
  if (!filename) return null;
  try {
    const filePath = path.join(process.cwd(), 'uploads', folder, filename);
    console.log('Checking file:', filePath);
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      return null;
    }
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    return 'data:' + mimeType + ';base64,' + base64;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

const result = getImageAsBase64('signature-1764678663685-501702611.jpeg', 'signatures');
console.log('Result starts with:', result ? result.substring(0, 50) : 'null');
console.log('Full length:', result ? result.length : 0);
