# 📜 Certificate Generator - Enterprise Certificate Management Platform

An enterprise-grade, high-performance, client-side web application for generating high-resolution certificates in bulk. Designed for universities, hackathons, workshops, conferences, and corporate organizations.

---

## 🌟 Key Features

- **🚀 Bulk Generation Engine**: Asynchronously generates hundreds or thousands of high-resolution certificates with zero main-thread freezing using chunked processing.
- **🛡 Generation Readiness Check**: Automated 11-point pre-flight validation audit with diagnostic action guidance and resource status metrics before starting generation.
- **✏️ Canva-Style Visual Editor**: Drag-and-drop element positioning, 8 resize handles, alignment tools, zoom controls, and a **Professional Template Style Lock System**.
- **🎨 Categorized Font Manager**: Integrated Google Fonts library across Modern Sans Serif, Elegant Serif, Display/Premium, and Signature/Script typefaces with local offline fallback.
- **📄 SheetJS 2D Spreadsheet Parser**: Lossless column data parsing (`.xlsx`, `.xls`, `.csv`) with dynamic column header auto-mapping.
- **📦 Windows-Compatible ZIP Export**: Packages all certificates into a compressed ZIP archive using JSZip DEFLATE level 6 with shallow, `MAX_PATH`-compliant folder structures.
- **💾 Client-Side Storage & Privacy**: Built with HTML5 Canvas, IndexedDB (`CertificateGeneratorDB`), and LocalStorage. 100% client-side execution with zero external server dependencies or data uploads.

---

## 🛠️ Technology Stack

- **Frontend Core**: Vanilla HTML5, Modern CSS3, JavaScript (ES6+)
- **Rendering Engine**: HTML5 2D Canvas API
- **Data & Archive Libraries**: 
  - [SheetJS (`xlsx.full.min.js`)](https://sheetjs.com/)
  - [JSZip (`jszip.min.js`)](https://stuk.github.io/jszip/)
  - [FileSaver.js (`FileSaver.min.js`)](https://github.com/eligrey/FileSaver.js/)
- **Persistence**: HTML5 IndexedDB & LocalStorage
- **Deployment**: 100% compatible with GitHub Pages

---

## 🚀 Getting Started

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (Edge, Chrome, Firefox, Safari).
3. **Workflow**:
   1. **Templates**: Upload your certificate background images (`PNG`, `JPG`, `WebP`).
   2. **Excel Files**: Import participant data spreadsheets (`.xlsx`, `.xls`, `.csv`).
   3. **Assignment**: Link templates to Excel workbooks.
   4. **Field Mapping**: Map certificate template variables to spreadsheet column headers.
   5. **Visual Editor**: Customize layout, typography, colors, and lock master styles.
   6. **Generate**: Run the pre-flight audit and generate all certificates into a downloadable ZIP archive!

---

## 🔒 Security & Privacy

All data parsing, image rendering, and ZIP compilation happen locally inside your web browser. No participant data or templates are transmitted to external servers.

---

## 📄 License

MIT License - Open Source for Educational and Commercial Use.
