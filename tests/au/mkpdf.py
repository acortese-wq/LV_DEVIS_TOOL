import sys, random, json
def pdf(path, ops, texts):
    # texts: [(x,y,size,str)]  ops: raw drawing operators
    c = ops + "\nBT\n" + "\n".join("/F1 %s Tf %.2f %.2f Td (%s) Tj 0 0 Td" % (sz, x, y, s) if False else "BT /F1 %s Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET" % (sz, x, y, s) for x, y, sz, s in texts) + "\nET\n"
    c = c.replace("\nBT\n", "\n", 1)
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            "<< /Length %d >>\nstream\n%s\nendstream" % (len(c), c), "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out = "%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs): offs.append(len(out)); out += "%d 0 obj\n%s\nendobj\n" % (i + 1, o)
    x = len(out); out += "xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + "".join("%010d 00000 n \n" % o for o in offs) + "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(path, "w", encoding="latin-1").write(out)
mm = 0.1764
# 1) Koordinatenraster
tx = []
for xp, v in [(100, "2'760'000"), (383.45, "2'760'050"), (666.9, "2'760'100")]: tx.append((xp - 17.1, 40, 8, v))
for yp, v in [(100, "1'190'000"), (383.45, "1'190'050")]: tx.append((20, yp - 2.8, 8, v))
tx.append((600, 560, 9, "Massstab 1:500"))
ops = "0.5 w 100 40 m 100 570 l S 383.45 40 m 383.45 570 l S 666.9 40 m 666.9 570 l S 30 100 m 800 100 l S 30 383.45 m 800 383.45 l S"
pdf("grid.pdf", ops, tx)
# 2) Vektorplan ohne Koordinaten + Ortswort
random.seed(7); rects = []
for i in range(34):
    w = random.uniform(8, 60); h = random.uniform(8, 40); x = random.uniform(40, 780 - w); y = random.uniform(40, 540 - h); rects.append((x, y, w, h))
for i in range(10):
    x1, y1 = random.uniform(40, 800), random.uniform(40, 550); x2, y2 = random.uniform(40, 800), random.uniform(40, 550); rects.append((x1, y1, x2 - x1, 0)); rects.append((x2, y2, 0, y1 - y2))
ops = "0.6 w " + " ".join("%.2f %.2f m %.2f %.2f l S" % (x, y, x + w, y + h) if (w == 0 or h == 0) else "%.2f %.2f %.2f %.2f re S" % (x, y, w, h) for x, y, w, h in rects)
pdf("match.pdf", ops, [(600, 560, 9, "Massstab 1:500"), (40, 570, 12, "Gemeinde Boezberg Situation"), (300, 570, 12, "Boezberg")])
json.dump(rects, open("rects.json", "w"))
print("ok")
