
# Plant Identifier – HE/AR

Files to drop into a Vite React app.

## Steps
1) Install Tailwind:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
2) Replace your files with the ones here:
   - `src/App.jsx`
   - `src/index.css`
   - `tailwind.config.js`
   - `postcss.config.js`
3) Put your API keys at the top of `src/App.jsx`:
   ```js
   const CONFIG = {
     PLANT_ID_API_KEY: "YOUR_PLANT_ID_API_KEY",
     PERENUAL_API_KEY: "YOUR_PERENUAL_API_KEY",
   };
   ```
4) Run:
   ```bash
   npm run dev
   ```

## Notes
- UI supports Hebrew/Arabic (RTL). Plant.id supports `language=ar`; for Hebrew we show HE UI + Wikipedia HE summaries.
- Care guidance pulled from Perenual species details.
