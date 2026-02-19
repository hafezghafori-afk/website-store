import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TemplateBaz Product";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

function slugToTitle(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function OpenGraphImage({ params }: { params: { slug: string } }) {
  const title = slugToTitle(params.slug) || "Template";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 50%, #ffffff 100%)",
          color: "#111111",
          padding: "72px"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "2px solid #e2e8f0",
            borderRadius: "28px",
            padding: "44px",
            background: "rgba(255,255,255,0.86)"
          }}
        >
          <div style={{ fontSize: 28, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.08em" }}>TEMPLATEBAZ</div>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.15, maxWidth: "90%" }}>{title}</div>
          <div style={{ fontSize: 28, color: "#334155" }}>Minimal Template Store</div>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
