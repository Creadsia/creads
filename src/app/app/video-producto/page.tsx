import type { Metadata } from "next";
import VideoProducto from "./video-producto";

export const metadata: Metadata = { title: "Video de producto" };
export default function Page() {
  return <VideoProducto />;
}
