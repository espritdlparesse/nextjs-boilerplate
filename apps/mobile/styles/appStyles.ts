import { addStyles } from "./add";
import { appTabStyles } from "./app";
import { homeStyles } from "./home";
import { libraryStyles } from "./library";
import { pillStyles } from "./pill";
import { profileStyles } from "./profile";
import { sharedStyles } from "./shared";

export const appStyles = {
  ...sharedStyles,
  ...appTabStyles,
  ...homeStyles,
  ...addStyles,
  ...libraryStyles,
  ...profileStyles,
  ...pillStyles,
};
