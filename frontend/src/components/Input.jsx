/**
 * Campo de formulario reutilizable.
 *
 * Gestiona de forma uniforme: etiqueta, error, ayuda, obligatorio y
 * configuración del input (type, placeholder, autocomplete, min/max).
 */

const TIPOS = ['text', 'email', 'password', 'tel', 'number', 'date', 'time', 'search', 'url'];

export default function Input({
  label,
  name,
  type = 'text',
  value = '',
  onChange,
  error = '',
  ayuda = '',
  requerido = false,
  placeholder = '',
  disabled = false,
  autoComplete,
  min,
  max,
  step,
  rows,
  className = '',
}) {
  const id = `campo-${name}`;
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const esArea = rows !== undefined;

  const clases = [
    'campo',
    error ? 'campo--error' : '',
    disabled ? 'campo--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const descripcion = error || ayuda;

  const propsComunes = {
    id,
    name,
    value,
    onChange,
    placeholder,
    disabled,
    required: requerido,
    'aria-invalid': Boolean(error),
    'aria-describedby': descripcion ? (error ? idError : idAyuda) : undefined,
    className: 'campo__control',
  };

  return (
    <div className={clases}>
      {label && (
        <label className="campo__label" htmlFor={id}>
          {label}
          {requerido && <span className="campo__obligatorio" aria-hidden="true">*</span>}
        </label>
      )}

      {esArea ? (
        <textarea {...propsComunes} rows={rows} />
      ) : (
        <input
          {...propsComunes}
          type={TIPOS.includes(type) ? type : 'text'}
          autoComplete={autoComplete}
          inputMode={type === 'tel' ? 'tel' : undefined}
          min={min}
          max={max}
          step={step}
        />
      )}

      {error && (
        <p className="campo__error" id={idError} role="alert">
          {error}
        </p>
      )}
      {!error && ayuda && (
        <p className="campo__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

/** Campo de selección (select) con la misma API visual que `Input`. */
export function Select({
  label,
  name,
  value = '',
  onChange,
  error = '',
  ayuda = '',
  requerido = false,
  disabled = false,
  opciones = [],
  placeholder = 'Seleccionar...',
  className = '',
}) {
  const id = `campo-${name}`;
  const clases = ['campo', error ? 'campo--error' : '', className].filter(Boolean).join(' ');

  return (
    <div className={clases}>
      {label && (
        <label className="campo__label" htmlFor={id}>
          {label}
          {requerido && <span className="campo__obligatorio" aria-hidden="true">*</span>}
        </label>
      )}

      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={requerido}
        aria-invalid={Boolean(error)}
        className="campo__control"
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor ?? opcion.id ?? opcion.nombre} value={opcion.valor ?? opcion.id ?? opcion.nombre}>
            {opcion.etiqueta ?? opcion.nombre}
          </option>
        ))}
      </select>

      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      {!error && ayuda && <p className="campo__ayuda">{ayuda}</p>}
    </div>
  );
}
