// Android Brand tab bar (Paper p-3-0, A02): floating opaque pill, no blur.
// 364 wide on a 412 phone (24 side gap), 64 high, 32 above the bottom edge.
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import {colors, fonts} from '../theme/tokens';
import {TAB_ICONS} from './tabs';

export default function BrandTabBar({state, descriptors, navigation}) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, {bottom: 32 + insets.bottom}]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const {options} = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const icons = TAB_ICONS[route.name];
          const onPress = () => {
            const event = navigation.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{selected: focused}}
              accessibilityLabel={label}
              testID={`tab-${route.name}`}
              android_ripple={{color: '#FFFFFF14', borderless: false}}
              style={[styles.item, focused && styles.itemOn]}>
              <Icon
                name={focused && icons.activeAndroid ? icons.activeAndroid : icons.icon}
                color={focused ? colors.androidActive : undefined}
              />
              <Text style={[styles.label, {color: focused ? colors.androidActive : colors.textSecondary}]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {position: 'absolute', left: 24, right: 24},
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: 32,
    backgroundColor: '#353535',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    elevation: 0,
  },
  item: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  itemOn: {backgroundColor: colors.tabActive, borderColor: '#1F89FA66'},
  label: {fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13, includeFontPadding: false},
});
