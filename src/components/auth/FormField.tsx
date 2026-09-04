type FormFieldProps = {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
};

export default function FormField({ id, label, type, placeholder, required }: FormFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      {label}
      <input id={id} name={id} type={type} placeholder={placeholder} required={required}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
    </label>
  );
}
