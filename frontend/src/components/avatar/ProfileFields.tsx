import { useState, type ReactNode } from 'react';
import { cx } from '../ui/cx';
import { Field, TextInput } from '../ui/Field';
import { AvatarPicker } from './AvatarPicker';
import './ProfileFields.css';

interface ProfileFieldsProps {
  id: string;
  label: string;
  name: string;
  onNameChange(name: string): void;
  image: string | null;
  onImageChange(image: string | null): void;
  color: string;
  placeholder?: string;
  error?: string | null;
  hint?: ReactNode;
  autoFocus?: boolean;
}

/** Round profile picture next to the name – the picture cropper takes the full width while open. */
export function ProfileFields({
  id,
  label,
  name,
  onNameChange,
  image,
  onImageChange,
  color,
  placeholder,
  error,
  hint,
  autoFocus,
}: ProfileFieldsProps) {
  const [cropping, setCropping] = useState(false);
  return (
    <div className={cx('profile-fields', cropping && 'is-cropping')}>
      <AvatarPicker
        compact={!cropping}
        size={64}
        name={name}
        color={color}
        image={image}
        onChange={onImageChange}
        onCroppingChange={setCropping}
      />
      <div className="profile-fields__name">
        <Field label={label} htmlFor={id} error={error} hint={hint}>
          <TextInput
            id={id}
            value={name}
            maxLength={40}
            autoComplete="off"
            placeholder={placeholder}
            invalid={Boolean(error)}
            data-autofocus={autoFocus || undefined}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
