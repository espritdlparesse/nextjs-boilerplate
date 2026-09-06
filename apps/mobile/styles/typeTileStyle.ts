import type { LibraryItem } from "../shared/everyyou/domain";
import { appStyles } from "./appStyles";

export function typeTileStyle(type: LibraryItem["type"]) {
  if (type === "music") return appStyles.tilePink;
  if (type === "book") return appStyles.tileBlue;
  return appStyles.tileYellow;
}
