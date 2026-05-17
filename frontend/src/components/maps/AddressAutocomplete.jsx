import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { searchAddresses } from '../../utils/nominatim.js';

function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder = 'Search address',
  required = false,
  disabled = false,
  name,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [open, setOpen] = useState(false);
  const ignoreNextSearch = useRef(false);

  useEffect(() => {
    if (ignoreNextSearch.current) {
      ignoreNextSearch.current = false;
      return undefined;
    }

    const search = String(value || '').trim();
    if (search.length < 3 || disabled) {
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setStatus('loading');
      try {
        const results = await searchAddresses(search, { signal: controller.signal });
        setSuggestions(results);
        setOpen(results.length > 0);
        setStatus('idle');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions([]);
          setStatus('error');
        }
      }
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [disabled, value]);

  function selectSuggestion(suggestion) {
    ignoreNextSearch.current = true;
    onChange(suggestion.label);
    onSelect?.(suggestion);
    setSuggestions([]);
    setOpen(false);
    setStatus('idle');
  }

  return (
    <div className="address-autocomplete">
      <div className="address-autocomplete-input">
        <Search size={16} />
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            if (nextValue.trim().length < 3) {
              setSuggestions([]);
              setOpen(false);
              setStatus('idle');
            } else {
              setOpen(true);
            }
          }}
          onFocus={() => setOpen(suggestions.length > 0)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="street-address"
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>

      {!disabled && open && suggestions.length > 0 && (
        <div className="address-suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              role="option"
            >
              <MapPin size={15} />
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}

      {status === 'loading' && <small className="address-status">Searching...</small>}
      {status === 'error' && <small className="address-status is-error">Address search unavailable.</small>}
    </div>
  );
}

export default AddressAutocomplete;
