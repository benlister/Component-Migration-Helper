# Component Migration Helper

A Figma plugin that helps you quickly gather Figma component keys and generate mappings and visual aids.

## 🚀 Features

- 🔍 **Component Key Mapping**  
  Map old component keys to new ones by selecting them directly in the canvas.

- ✏️ **Manual Key Entry**  
  Paste in old/new component keys manually—perfect for power users or when selections aren't possible.

- 🧠 **Duplicate Detection**  
  Warns you if you try to map a component to itself or duplicate an existing mapping.

- 📋 **Copy Tools**  
  Easily copy all old or new keys with a single click—great for version control or scripting.

- 🖼 **Generate Visuals**  
  Sends your mappings to Figma for previewing updated components side by side.

- 💾 **Session Persistence**  
  Automatically loads previous session mappings and warns if they're stale (older than 2 weeks).

- 🧼 **Clear, Export, and Reset**  
  Start fresh or export your mapping as a CSV.

## 🛠 Usage

1. **Install the plugin** from Figma (or sideload if you're developing).
2. **Select** one or more legacy components in your file.
3. **Click "Start Mapping"** and follow the UI to select their replacements.
4. **Optionally paste keys manually** if you already know the mappings.
5. **Copy keys** or **export a CSV** when you're done.

## 📂 Export Format

When you export to CSV, the file includes a list of old and new key mappings to integrate into other plugins and tools.
