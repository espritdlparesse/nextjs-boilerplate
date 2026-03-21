import { Pressable, Text, View } from "react-native";
import { formatFullDate, SOURCE_LABEL, TYPE_LABEL, type ContentType, type LibraryItem, type SourceType } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";

type LibraryScreenProps = {
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
  selectedItem: LibraryItem | null;
  visibleLibrary: LibraryItem[];
  onTypeFilterChange: (value: TypeFilter) => void;
  onSourceFilterChange: (value: SourceFilter) => void;
  onSelectItem: (id: string) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
};

function typeTileStyle(type: LibraryItem["type"]) {
  if (type === "music") return appStyles.tilePink;
  if (type === "book") return appStyles.tileBlue;
  return appStyles.tileYellow;
}

export function LibraryScreen({
  typeFilter,
  sourceFilter,
  selectedItem,
  visibleLibrary,
  onTypeFilterChange,
  onSourceFilterChange,
  onSelectItem,
  onEditItem,
  onDeleteItem,
}: LibraryScreenProps) {
  return (
    <View style={appStyles.screen}>
      <View style={[appStyles.card, appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>library</Text>
        <Text style={appStyles.helper}>смотри все вместе или раскладывай по типам. в карточках видна дата, чтобы библиотека ощущалась как личная история, а не архив.</Text>

        <Text style={appStyles.label}>тип контента</Text>
        <View style={appStyles.row}>
          {(["all", "music", "book", "film"] as TypeFilter[]).map((value) => (
            <PillButton
              key={value}
              label={value === "all" ? "все" : TYPE_LABEL[value]}
              active={typeFilter === value}
              onPress={() => onTypeFilterChange(value)}
            />
          ))}
        </View>

        <Text style={appStyles.label}>источник</Text>
        <View style={appStyles.row}>
          {(["all", "manual", "import_spotify"] as SourceFilter[]).map((value) => (
            <PillButton
              key={value}
              label={value === "all" ? "все" : SOURCE_LABEL[value]}
              active={sourceFilter === value}
              onPress={() => onSourceFilterChange(value)}
            />
          ))}
        </View>
      </View>

      {selectedItem ? (
        <View style={[appStyles.tile, typeTileStyle(selectedItem.type)]}>
          <View style={appStyles.tileTopRow}>
            <View style={appStyles.typeBadge}>
              <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[selectedItem.type]}</Text>
            </View>
            <Text style={appStyles.metaDate}>
              {selectedItem.createdAt ? formatFullDate(selectedItem.createdAt) : "дата неизвестна"}
            </Text>
          </View>
          <Text style={appStyles.itemTitle}>{selectedItem.title}</Text>
          <Text style={appStyles.itemMeta}>{selectedItem.authorOrArtist || "без автора"}</Text>
          <Text style={appStyles.metaText}>источник: {SOURCE_LABEL[selectedItem.source]}</Text>
          <PillButton label="редактировать" onPress={() => onEditItem(selectedItem.id)} />
          <PillButton label="удалить" variant="danger" onPress={() => onDeleteItem(selectedItem.id)} />
        </View>
      ) : null}

      {visibleLibrary.length === 0 ? (
        <View style={appStyles.card}>
          <Text style={appStyles.helper}>пока пусто. попробуй spotify import, screenshot import или загрузку файла.</Text>
        </View>
      ) : (
        <View style={appStyles.tileGrid}>
          {visibleLibrary.map((item) => (
            <Pressable
              key={item.id}
              style={[appStyles.tile, appStyles.libraryTile, typeTileStyle(item.type)]}
              onPress={() => onSelectItem(item.id)}
            >
              <View style={appStyles.tileTopRow}>
                <View style={appStyles.typeBadge}>
                  <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
                </View>
                <Text style={appStyles.metaDate}>
                  {item.createdAt ? formatFullDate(item.createdAt) : "без даты"}
                </Text>
              </View>

              <View>
                <Text style={appStyles.itemMeta}>{item.authorOrArtist || TYPE_LABEL[item.type]}</Text>
                <Text style={appStyles.itemTitle}>{item.title}</Text>
              </View>

              <Text style={appStyles.metaText}>{SOURCE_LABEL[item.source]}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
