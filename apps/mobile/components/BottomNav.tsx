import { Pressable, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";
import { type Tab } from "../shared/everyyou/domain";

type NavItem = { key: Exclude<Tab, "add">; label: string; icon: string };

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "главная", icon: "◉" },
  { key: "library", label: "библиотека", icon: "▦" },
  { key: "analysis", label: "вайбчек", icon: "✦" },
  { key: "profile", label: "профиль", icon: "🌝" },
];

function NavButton({ item, active, theme, onPress }: {
  item: NavItem;
  active: boolean;
  theme: ReturnType<typeof getTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable style={appStyles.bottomItem} onPress={onPress}>
      <View
        style={[appStyles.bottomIcon, { backgroundColor: active ? theme.bottomIconActiveBg : theme.bottomIconBg }]}
      >
        <Text style={[appStyles.secondaryText, { color: theme.bottomIconText }]}>{item.icon}</Text>
      </View>
      <Text
        style={[appStyles.bottomItemLabel, { color: active ? theme.bottomLabelActive : theme.bottomLabel }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export function BottomNav({ tab, theme, onSelect }: {
  tab: Tab;
  theme: ReturnType<typeof getTheme>;
  onSelect: (tab: Tab) => void;
}) {
  function renderItems(items: NavItem[]) {
    return items.map((item) => (
      <NavButton key={item.key} item={item} active={tab === item.key} theme={theme} onPress={() => onSelect(item.key)} />
    ));
  }

  return (
    <View style={[appStyles.bottomBar, { backgroundColor: theme.bottomBarBg, borderColor: theme.bottomBarBorder }]}>
      {renderItems(NAV_ITEMS.slice(0, 2))}
      <View style={appStyles.bottomPlusWrap}>
        <Pressable style={[appStyles.bottomPlus, { borderColor: theme.bottomPlusBorder }]} onPress={() => onSelect("add")}>
          <Text style={appStyles.bottomPlusText}>+</Text>
        </Pressable>
      </View>
      {renderItems(NAV_ITEMS.slice(2))}
    </View>
  );
}
