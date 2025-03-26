import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageUrl = 'https://image.nostr.build/f113a0251c24cc33aeb49f06684d15aa65a18e7a1cd6a9011487028a350d9991.jpg';
const outputPath = path.join(__dirname, '..', 'public', 'icons', 'source-icon.jpg');

// Create the icons directory if it doesn't exist
fs.mkdirSync(path.join(__dirname, '..', 'public', 'icons'), { recursive: true });

https.get(imageUrl, (response) => {
  const fileStream = fs.createWriteStream(outputPath);
  response.pipe(fileStream);

  fileStream.on('finish', () => {
    fileStream.close();
    console.log('Image downloaded successfully');
  });
}).on('error', (err) => {
  console.error('Error downloading image:', err.message);
}); 