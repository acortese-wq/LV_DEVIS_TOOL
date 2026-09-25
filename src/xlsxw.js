/* Minimaler XLSX-Schreiber (ohne Abhängigkeiten): Zellen, Formeln mit Zwischenwert, Formatvorlagen. */
var XLSXW = (function () {
  "use strict";
  var ST = { def: 0, hdr: 1, grp: 2, num: 3, sum: 4, title: 5, bold: 6, wrap: 7, ctx: 8, amber: 9, red: 10, numAmber: 11, numRed: 12,
             grey: 13, int: 14, sumFill: 15, sumLbl: 16, pct: 17, elTitle: 18, code: 19, stop: 20, warnA: 21, info: 22 };

  var crcT = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = function (s) { return new TextEncoder().encode(s); };

  function zip(files) {
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = enc(f.name), d = f.data, crc = crc32(d);
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(d.length), u32(d.length), u16(nm.length), u16(0));
      parts.push(new Uint8Array(lh), nm, d);
      central.push({ nm: nm, crc: crc, len: d.length, off: off });
      off += lh.length + nm.length + d.length;
    });
    var cdStart = off, cdSize = 0;
    central.forEach(function (c) {
      var h = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.len), u32(c.len),
                        u16(c.nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      parts.push(new Uint8Array(h), c.nm); cdSize += h.length + c.nm.length;
    });
    parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdStart), u16(0))));
    var total = parts.reduce(function (s, p) { return s + p.length; }, 0), out = new Uint8Array(total), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  var esc = function (s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  function col(n) { var s = ""; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

  function sheetXml(sh, noCache) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"' + (sh.first ? ' tabSelected="1"' : "") + '>' +
      (sh.freeze ? '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' : "") + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>';
    if (sh.cols) x += "<cols>" + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols>";
    x += "<sheetData>";
    sh.rows.forEach(function (row, ri) {
      if (!row || !row.length) { x += '<row r="' + (ri + 1) + '"/>'; return; }
      x += '<row r="' + (ri + 1) + '">';
      row.forEach(function (c, ci) {
        if (c == null || c === "") return;
        if (typeof c !== "object") c = { v: c };
        var ref = col(ci) + (ri + 1), s = c.s || 0;
        if (c.f != null) {
          var isStr = typeof c.v === "string";
          x += '<c r="' + ref + '" s="' + s + '"' + (isStr ? ' t="str"' : "") + "><f>" + esc(c.f) + "</f>" + (noCache ? "" : "<v>" + esc(c.v == null ? 0 : c.v) + "</v>") + "</c>";
        } else if (typeof c.v === "number") x += '<c r="' + ref + '" s="' + s + '"><v>' + c.v + "</v></c>";
        else x += '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + "</t></is></c>";
      });
      x += "</row>";
    });
    x += '</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    return x;
  }

  function stylesXml() {
    var fonts = [
      '<font><sz val="10"/><name val="Arial"/></font>',
      '<font><b/><sz val="10"/><name val="Arial"/></font>',
      '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>',
      '<font><sz val="8"/><color rgb="FF71767C"/><name val="Arial"/></font>',
      '<font><b/><sz val="15"/><color rgb="FF0D47C8"/><name val="Arial"/></font>',
      '<font><sz val="10"/><color rgb="FF71767C"/><name val="Arial"/></font>',
      '<font><sz val="9"/><name val="Consolas"/></font>',
      '<font><b/><sz val="10"/><color rgb="FFC2192B"/><name val="Arial"/></font>',
      '<font><sz val="10"/><color rgb="FF8A5B00"/><name val="Arial"/></font>'
    ];
    var fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0D47C8"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF0F1F3"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFDF5E6"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFDECED"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F6FA"/></patternFill></fill>'];
    var borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE4E6E9"/></bottom><diagonal/></border>',
      '<border><left/><right/><top style="thin"><color rgb="FF1A1C1E"/></top><bottom/><diagonal/></border>'];
    var al = function (w) { return '<alignment vertical="top"' + (w ? ' wrapText="1"' : "") + "/>"; };
    var xf = function (font, fill, border, num, w, h) {
      return '<xf numFmtId="' + num + '" fontId="' + font + '" fillId="' + fill + '" borderId="' + border + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1">' +
        (h ? '<alignment horizontal="' + h + '" vertical="top"' + (w ? ' wrapText="1"' : "") + "/>" : al(w)) + "</xf>";
    };
    var xfs = [
      xf(0, 0, 0, 0, 0),            // 0 default
      xf(2, 2, 0, 0, 1),            // 1 Kopf
      xf(1, 3, 0, 0, 0),            // 2 Gruppe
      xf(0, 0, 1, 164, 0),          // 3 Zahl
      xf(1, 0, 2, 164, 0),          // 4 Summe
      xf(4, 0, 0, 0, 0),            // 5 Titel
      xf(1, 0, 0, 0, 0),            // 6 fett
      xf(0, 0, 1, 0, 1),            // 7 Text umbrechen
      xf(3, 0, 0, 0, 1),            // 8 Kontext klein
      xf(8, 4, 1, 0, 1),            // 9 Hinweis gelb
      xf(7, 5, 1, 0, 1),            // 10 rot
      xf(8, 4, 1, 164, 0),          // 11 Zahl gelb
      xf(7, 5, 1, 164, 0),          // 12 Zahl rot
      xf(5, 0, 0, 0, 0),            // 13 grau
      xf(0, 0, 1, 1, 0),            // 14 ganze Zahl
      xf(1, 6, 2, 164, 0),          // 15 Summe hinterlegt
      xf(1, 6, 2, 0, 0),            // 16 Summenbezeichnung
      xf(0, 0, 1, 165, 0),          // 17 Prozent
      xf(1, 3, 0, 0, 0),            // 18 Elementtitel
      xf(6, 0, 1, 0, 0),            // 19 Positionsnummer
      xf(7, 5, 0, 0, 1),            // 20 kritisch
      xf(8, 4, 0, 0, 1),            // 21 Hinweis
      xf(5, 0, 0, 0, 1)             // 22 Info
    ];
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.0&quot; %&quot;"/></numFmts>' +
      '<fonts count="' + fonts.length + '">' + fonts.join("") + '</fonts><fills count="' + fills.length + '">' + fills.join("") + '</fills>' +
      '<borders count="' + borders.length + '">' + borders.join("") + '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join("") + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  function build(sheets, opts) {
    opts = opts || {};
    var n = sheets.length, ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>';
    var rel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    var files = [];
    sheets.forEach(function (sh, i) {
      ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wb += '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      rel += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      sh.first = i === 0;
      files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: enc(sheetXml(sh, opts.noCache)) });
    });
    ct += "</Types>"; wb += '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
    rel += '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    var root = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    files.unshift({ name: "[Content_Types].xml", data: enc(ct) }, { name: "_rels/.rels", data: enc(root) },
      { name: "xl/workbook.xml", data: enc(wb) }, { name: "xl/_rels/workbook.xml.rels", data: enc(rel) }, { name: "xl/styles.xml", data: enc(stylesXml()) });
    return zip(files);
  }
  return { build: build, ST: ST, col: col };
})();
if (typeof module !== "undefined") module.exports = XLSXW;
