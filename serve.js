import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Set cross-origin isolation headers for all responses
app.use((req, res, next) => {
    res.set('Cross-Origin-Embedder-Policy', 'require-corp');
    res.set('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

// Serve static files with cross-origin isolation
app.use(express.static(__dirname));

// Start the server
const port = 9000
app.listen(port, () => {
    console.log(`Server running on port ${port} with cross-origin isolation enabled`);
});
