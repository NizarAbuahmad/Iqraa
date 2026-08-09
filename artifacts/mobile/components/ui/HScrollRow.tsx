/**
 * Horizontal chip strip that starts on the correct edge in RTL.
 *
 * The app renders RTL per-component (`row-reverse`) rather than flipping the
 * whole layout through I18nManager, so a horizontal ScrollView still scrolls
 * left-to-right. With reversed content that means an Arabic strip opens on its
 * *last* chip and clips the first one — which is what buried "خطة درس" at the
 * edge of the lesson card. Scrolling to the end once content is measured puts
 * the first chip back under the teacher's thumb.
 */
import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';

type Props = {
  isRTL: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function HScrollRow({ isRTL, children, style, contentContainerStyle }: Props) {
  const ref = useRef<ScrollView>(null);

  const handleContentSizeChange = useCallback(() => {
    if (isRTL) ref.current?.scrollToEnd({ animated: false });
  }, [isRTL]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={handleContentSizeChange}
      style={style}
      contentContainerStyle={[
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
