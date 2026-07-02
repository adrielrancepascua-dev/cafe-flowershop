import { useMemo, useState } from 'react';
import {
  buildFlowerProductColorOptions,
  isPresetFlowerProductColor,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';

const CUSTOM_COLOR_VALUE = '__custom__';

type FlowerProductColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  existingColors?: string[];
  className?: string;
  required?: boolean;
};

export default function FlowerProductColorPicker({
  value,
  onChange,
  existingColors = [],
  className = 'flower-input',
  required = false,
}: FlowerProductColorPickerProps) {
  const colorOptions = useMemo(
    () => buildFlowerProductColorOptions(existingColors),
    [existingColors],
  );
  const normalizedValue = normalizeFlowerProductColor(value);
  const usesCustomColor = Boolean(value) && !isPresetFlowerProductColor(normalizedValue);
  const [mode, setMode] = useState<'preset' | 'custom'>(
    usesCustomColor ? 'custom' : 'preset',
  );
  const [customDraft, setCustomDraft] = useState(usesCustomColor ? normalizedValue : '');

  function handleSelectChange(nextValue: string) {
    if (nextValue === CUSTOM_COLOR_VALUE) {
      setMode('custom');
      if (customDraft.trim()) {
        onChange(customDraft.trim());
      }
      return;
    }

    setMode('preset');
    onChange(nextValue);
  }

  function handleCustomChange(nextValue: string) {
    setCustomDraft(nextValue);
    onChange(nextValue.trim());
  }

  return (
    <div className="space-y-2">
      <select
        value={mode === 'custom' ? CUSTOM_COLOR_VALUE : normalizedValue}
        onChange={(event) => handleSelectChange(event.target.value)}
        className={className}
        required={required && mode === 'preset'}
      >
        {colorOptions.map((color) => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
        <option value={CUSTOM_COLOR_VALUE}>Add custom color…</option>
      </select>
      {mode === 'custom' ? (
        <input
          type="text"
          value={customDraft}
          onChange={(event) => handleCustomChange(event.target.value)}
          placeholder="e.g. Coral, Burgundy"
          className={className}
          required={required}
        />
      ) : null}
    </div>
  );
}
