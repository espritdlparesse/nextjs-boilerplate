import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from "react-native-svg";

type Brand = "spotify" | "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi";

type BrandLogoProps = {
  brand: Brand;
};

function SpotifyLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <Circle cx="18" cy="18" r="15" fill="#1ED760" />
      <Path d="M10 12.8c5.7-1.4 11.5-.9 16.9 1.7" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M11.7 17c4.5-1.1 9-.6 13.1 1.4" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <Path d="M13.5 21c3.2-.8 6.2-.4 9 1" stroke="#111" strokeWidth="1.8" strokeLinecap="round" />
      <SvgText x="42" y="24" fontSize="20" fontWeight="800" fill="#111">
        Spotify
      </SvgText>
    </Svg>
  );
}

function LivelibLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <Rect x="4" y="7" width="18" height="22" rx="4" fill="#49DE4E" />
      <Rect x="8" y="10" width="10" height="2" rx="1" fill="#111" />
      <Rect x="8" y="15" width="8" height="2" rx="1" fill="#111" />
      <Rect x="8" y="20" width="11" height="2" rx="1" fill="#111" />
      <SvgText x="34" y="24" fontSize="19" fontWeight="800" fill="#111">
        LiveLib
      </SvgText>
    </Svg>
  );
}

function GoodreadsLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <SvgText x="4" y="24" fontSize="21" fontWeight="800" fill="#6F4E37">
        Goodreads
      </SvgText>
    </Svg>
  );
}

function LetterboxdLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <Circle cx="13" cy="18" r="8" fill="#FF8000" />
      <Circle cx="22" cy="18" r="8" fill="#00C030" />
      <Circle cx="17.5" cy="18" r="8" fill="#38C0FF" />
      <SvgText x="38" y="24" fontSize="18" fontWeight="800" fill="#111">
        Letterboxd
      </SvgText>
    </Svg>
  );
}

function LastfmLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <SvgText x="4" y="24" fontSize="22" fontWeight="800" fill="#D51007">
        last.fm
      </SvgText>
    </Svg>
  );
}

function KinopoiskLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <Path
        d="M17.5 4l3.2 7.2 7.8.8-5.8 5 1.6 7.6-6.8-4-6.8 4 1.6-7.6-5.8-5 7.8-.8L17.5 4z"
        fill="#FF6B00"
      />
      <SvgText x="36" y="24" fontSize="18" fontWeight="800" fill="#111">
        Кинопоиск
      </SvgText>
    </Svg>
  );
}

function MubiLogo() {
  return (
    <Svg width={170} height={36} viewBox="0 0 170 36">
      <Circle cx="12" cy="18" r="5" fill="#111" />
      <Circle cx="24" cy="10" r="4" fill="#111" />
      <Circle cx="24" cy="26" r="4" fill="#111" />
      <Circle cx="36" cy="18" r="5" fill="#111" />
      <SvgText x="50" y="24" fontSize="22" fontWeight="800" letterSpacing="1.5" fill="#111">
        MUBI
      </SvgText>
    </Svg>
  );
}

export function BrandLogo({ brand }: BrandLogoProps) {
  if (brand === "spotify") return <SpotifyLogo />;
  if (brand === "livelib") return <LivelibLogo />;
  if (brand === "goodreads") return <GoodreadsLogo />;
  if (brand === "letterboxd") return <LetterboxdLogo />;
  if (brand === "lastfm") return <LastfmLogo />;
  if (brand === "kinopoisk") return <KinopoiskLogo />;
  return <MubiLogo />;
}
