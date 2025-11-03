# Internationalization (i18n) Setup

This application uses `i18next` and `react-i18next` for internationalization support.

## Supported Languages

- **English (en)** - Default language
- **Sinhala (si)** - සිංහල

## Usage in Components

### 1. Import the useTranslation hook

```jsx
import { useTranslation } from 'react-i18next';
```

### 2. Use the hook in your component

```jsx
const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <button>{t('common.submit')}</button>
    </div>
  );
};
```

### 3. Using interpolation

```jsx
// In translation file: "greeting": "Hello, {{name}}!"
<p>{t('greeting', { name: 'John' })}</p>
// Output: Hello, John!
```

## Adding the Language Switcher

Import and use the `LanguageSwitcher` component in your layout or navigation:

```jsx
import LanguageSwitcher from '../components/LanguageSwitcher';

const Layout = () => {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  );
};
```

## Translation File Structure

Translation files are located in `src/i18n/locales/`:
- `en.json` - English translations
- `si.json` - Sinhala translations

### Example structure:

```json
{
  "common": {
    "submit": "Submit",
    "cancel": "Cancel"
  },
  "auth": {
    "login": {
      "title": "Sign In",
      "username": "Username"
    }
  }
}
```

## Adding New Translations

1. Add the new key-value pair to `src/i18n/locales/en.json`
2. Add the corresponding translation to `src/i18n/locales/si.json`
3. Use the translation key in your component with `t('your.translation.key')`

## Configuration

The i18n configuration is in `src/i18n/config.js`. Key features:
- Automatic language detection from browser settings
- Language preference stored in localStorage
- Fallback to English if translation is missing

## Language Codes

- `en` - English
- `si` - Sinhala (සිංහල)

## Best Practices

1. **Group related translations**: Organize translations by feature or page (e.g., `auth.login.title`)
2. **Use descriptive keys**: Make translation keys self-explanatory
3. **Keep translations consistent**: Use the same terminology across the app
4. **Always add to both files**: When adding a new translation, update both English and Sinhala files
5. **Use interpolation**: For dynamic content, use interpolation instead of string concatenation

## Examples

### Simple text
```jsx
{t('common.loading')}
```

### With variables
```jsx
{t('auth.register.joinCompany', { companyName: 'Acme Corp' })}
```

### Button text
```jsx
<button>{t('common.submit')}</button>
```

### Form labels
```jsx
<label>{t('auth.login.username')}</label>
```

## Need Help?

- Check the [i18next documentation](https://www.i18next.com/)
- Check the [react-i18next documentation](https://react.i18next.com/)
