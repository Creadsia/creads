import Editor from "./editor";

export const metadata = { title: "Editor de video" };

// the editor's fonts, so the preview shows the same letters the export burns in
const FACES = [["Montserrat ExtraBold", "Montserrat-ExtraBold"], ["Anton", "Anton-Regular"], ["Bebas Neue", "BebasNeue-Regular"], ["Poppins ExtraBold", "Poppins-ExtraBold"], ["Archivo Black", "ArchivoBlack-Regular"], ["Inter Black", "Inter-Black"]];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <style>{FACES.map(([n, f]) => `@font-face{font-family:"${n}";src:url(/fonts/${f}.ttf) format("truetype");font-display:swap}`).join("")}</style>
      <Editor id={id} />
    </>
  );
}
