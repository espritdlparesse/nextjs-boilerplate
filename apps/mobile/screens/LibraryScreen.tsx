import { Text, View } from "react-native";
import { SOURCE_LABEL, TYPE_LABEL, type ContentType, type LibraryItem, type SourceType } from "../shared/everyyou/domain";
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
    <View style={appStyles.card}>
      <Text style={appStyles.sectionTitle}>library</Text>
      <Text style={appStyles.label}>фильтр по типу</Text>
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

      <Text style={appStyles.label}>фильтр по источнику</Text>
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

      {selectedItem && (
        <View style={appStyles.tile}>
          <Text style={appStyles.itemTitle}>{selectedItem.title}</Text>
          <Text style={appStyles.itemMeta}>{selectedItem.authorOrArtist}</Text>
          <Text style={appStyles.metaText}>
            {TYPE_LABEL[selectedItem.type]} · {SOURCE_LABEL[selectedItem.source]}
          </Text>
          <PillButton
            label="редактировать"
            onPress={() => onEditItem(selectedItem.id)}
          />
          <PillButton label="удалить" variant="danger" onPress={() => onDeleteItem(selectedItem.id)} />
        </View>
      )}

      <View style={appStyles.stack}>
        {visibleLibrary.length === 0 ? (
          <Text style={appStyles.helper}>пока пусто. добавь что-нибудь вручную или через импорт.</Text>
        ) : (
          visibleLibrary.map((item) => (
            <PillButton
              key={item.id}
              label={`${item.title} · ${item.authorOrArtist}`}
              onPress={() => onSelectItem(item.id)}
              style={appStyles.tile}
            />
          ))
        )}
      </View>
    </View>
  );
}
