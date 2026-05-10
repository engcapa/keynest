import React, { cloneElement, isValidElement } from 'react';
import { Platform, View } from 'react-native';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Cross-platform tooltip / accessibility helper.
 * - Web: wraps in a <span title={label}> with `display: contents` so hover shows a
 *   native browser tooltip without disturbing layout.
 * - Native: clones the child and fills in `accessibilityLabel` / `accessibilityHint`
 *   (screen readers announce it; some platforms also long-press for a hint).
 */
export function Tooltip({ label, children }: TooltipProps) {
  if (!label) return <>{children}</>;

  if (Platform.OS === 'web') {
    return (
      // @ts-ignore — raw DOM element is fine under react-native-web.
      <span title={label} aria-label={label} style={{ display: 'contents' }}>
        {children}
      </span>
    );
  }

  if (isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    return cloneElement(child, {
      accessibilityLabel: child.props.accessibilityLabel ?? label,
      accessibilityHint: child.props.accessibilityHint ?? label,
      accessible: child.props.accessible ?? true,
    });
  }

  return (
    <View accessible accessibilityLabel={label} accessibilityHint={label}>
      {children}
    </View>
  );
}
