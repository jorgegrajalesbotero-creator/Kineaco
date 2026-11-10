import { describe, it, expect } from "vitest";
import { youtubeVideo } from "@/lib/youtube";

describe("youtubeVideo", () => {
  it("reconoce el enlace normal", () => {
    const v = youtubeVideo("https://www.youtube.com/watch?v=1BL4681pIz4");
    expect(v.id).toBe("1BL4681pIz4");
    expect(v.vertical).toBe(false);
    expect(v.embedUrl).toBe("https://www.youtube-nocookie.com/embed/1BL4681pIz4?autoplay=1&rel=0&playsinline=1");
  });
  it("reconoce Shorts y los marca como verticales", () => {
    const v = youtubeVideo("https://youtube.com/shorts/ey_VUOAB4EQ?si=HoGND8vBCbXzY5A5");
    expect(v.id).toBe("ey_VUOAB4EQ");
    expect(v.vertical).toBe(true);
  });
  it("reconoce youtu.be, embed, móvil y parámetros extra", () => {
    expect(youtubeVideo("https://youtu.be/1BL4681pIz4?t=30").id).toBe("1BL4681pIz4");
    expect(youtubeVideo("https://www.youtube.com/embed/1BL4681pIz4").id).toBe("1BL4681pIz4");
    expect(youtubeVideo("https://m.youtube.com/watch?feature=share&v=1BL4681pIz4").id).toBe("1BL4681pIz4");
    expect(youtubeVideo("  https://www.youtube.com/watch?v=1BL4681pIz4  ").id).toBe("1BL4681pIz4");
  });
  it("rechaza lo que no es un video de YouTube", () => {
    expect(youtubeVideo("")).toBeNull();
    expect(youtubeVideo(null)).toBeNull();
    expect(youtubeVideo("no es un enlace")).toBeNull();
    expect(youtubeVideo("https://vimeo.com/123456789")).toBeNull();
    expect(youtubeVideo("https://www.youtube.com/@canal")).toBeNull();
    expect(youtubeVideo("https://www.youtube.com/watch?v=corto")).toBeNull();
    expect(youtubeVideo("javascript:alert(1)")).toBeNull();
  });
  it("no deja colar dominios parecidos ni identificadores raros", () => {
    expect(youtubeVideo("https://youtube.com.malo.com/watch?v=1BL4681pIz4")).toBeNull();
    expect(youtubeVideo("https://notyoutube.com/watch?v=1BL4681pIz4")).toBeNull();
    expect(youtubeVideo("https://www.youtube.com/embed/1BL4681pIz4%22onload")).toBeNull();
    expect(youtubeVideo("https://www.youtube.com/watch?v=1BL4681pIz4&v2=<script>").embedUrl).not.toContain("<");
  });
});
