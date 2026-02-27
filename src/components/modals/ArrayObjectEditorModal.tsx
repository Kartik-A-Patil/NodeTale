import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { VariableType, ArrayValue, ObjectValue } from '../../types';

let objectKeyCounter = 0;

interface ArrayObjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  variableName: string;
  variableType: VariableType.ARRAY | VariableType.OBJECT;
  value: ArrayValue | ObjectValue;
  onChange: (newValue: ArrayValue | ObjectValue) => void;
}

export const ArrayObjectEditorModal: React.FC<ArrayObjectEditorModalProps> = ({
  isOpen,
  onClose,
  variableName,
  variableType,
  value,
  onChange
}) => {
  if (!isOpen) return null;

  const handleAddArrayElement = () => {
    const arrayVal = value as ArrayValue;
    const defaultVal = arrayVal.elementType === VariableType.STRING ? '' 
      : arrayVal.elementType === VariableType.NUMBER ? 0 
      : false;
    onChange({
      ...arrayVal,
      elements: [...arrayVal.elements, defaultVal]
    });
  };

  const handleUpdateArrayElement = (index: number, newValue: string | number | boolean) => {
    const arrayVal = value as ArrayValue;
    const updated = [...arrayVal.elements];
    updated[index] = newValue;
    onChange({ ...arrayVal, elements: updated });
  };

  const handleDeleteArrayElement = (index: number) => {
    const arrayVal = value as ArrayValue;
    onChange({
      ...arrayVal,
      elements: arrayVal.elements.filter((_, i) => i !== index)
    });
  };

  const handleChangeArrayType = (newType: VariableType.STRING | VariableType.NUMBER | VariableType.BOOLEAN) => {
    const arrayVal = value as ArrayValue;
    const convertedElements = arrayVal.elements.map(el => {
      if (newType === VariableType.STRING) return String(el);
      if (newType === VariableType.NUMBER) return Number(el) || 0;
      return Boolean(el);
    });
    onChange({
      elementType: newType,
      elements: convertedElements
    });
  };

  const handleAddObjectKey = () => {
    const objVal = value as ObjectValue;
    objectKeyCounter++;
    const newKey = `key${objectKeyCounter}`;
    onChange({
      keys: {
        ...objVal.keys,
        [newKey]: { type: VariableType.STRING, value: '' }
      }
    });
  };

  const handleUpdateObjectKey = (oldKey: string, newKey: string) => {
    const objVal = value as ObjectValue;
    const { [oldKey]: val, ...rest } = objVal.keys;
    onChange({
      keys: { ...rest, [newKey]: val }
    });
  };

  const handleUpdateObjectValue = (key: string, newValue: string | number | boolean) => {
    const objVal = value as ObjectValue;
    onChange({
      keys: {
        ...objVal.keys,
        [key]: { ...objVal.keys[key], value: newValue }
      }
    });
  };

  const handleUpdateObjectValueType = (key: string, newType: VariableType.STRING | VariableType.NUMBER | VariableType.BOOLEAN) => {
    const objVal = value as ObjectValue;
    const currentVal = objVal.keys[key].value;
    let convertedVal: string | number | boolean;
    if (newType === VariableType.STRING) convertedVal = String(currentVal);
    else if (newType === VariableType.NUMBER) convertedVal = Number(currentVal) || 0;
    else convertedVal = Boolean(currentVal);
    
    onChange({
      keys: {
        ...objVal.keys,
        [key]: { type: newType, value: convertedVal }
      }
    });
  };

  const handleDeleteObjectKey = (key: string) => {
    const objVal = value as ObjectValue;
    const { [key]: _, ...rest } = objVal.keys;
    onChange({ keys: rest });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-900 rounded-xl w-full max-w-2xl h-[520px] flex flex-col shadow-2xl border border-zinc-800/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {variableName}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">{variableType === VariableType.ARRAY ? 'Array of values' : 'Object with key-value pairs'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-zinc-800/50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 border-t border-zinc-100/30">
          {variableType === VariableType.ARRAY ? (
            <div className="space-y-5 h-full flex flex-col">
              {/* Array Controls */}
              <div className="flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Type:</span>
                  <select
                    className="bg-zinc-800 text-zinc-300 text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                    value={(value as ArrayValue).elementType}
                    onChange={(e) => handleChangeArrayType(e.target.value as VariableType.STRING | VariableType.NUMBER | VariableType.BOOLEAN)}
                  >
                    <option value={VariableType.STRING}>String</option>
                    <option value={VariableType.NUMBER}>Number</option>
                    <option value={VariableType.BOOLEAN}>Boolean</option>
                  </select>
                </div>
                <button
                  onClick={handleAddArrayElement}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex-shrink-0"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              {/* Array Elements */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {(value as ArrayValue).elements.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    <p>No elements yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Click "Add" to create one</p>
                  </div>
                ) : (
                  (value as ArrayValue).elements.map((el, idx) => (
                    <div key={idx} className="flex items-center gap-3 group">
                      <span className="text-xs text-zinc-600 font-mono w-8 pt-2.5 flex-shrink-0">[{idx}]</span>
                      <div className="flex-1">
                        {(value as ArrayValue).elementType === VariableType.BOOLEAN ? (
                          <button
                            onClick={() => handleUpdateArrayElement(idx, !el)}
                            className={`w-full text-left text-xs font-mono px-4 py-2.5 rounded-lg transition-colors font-medium ${
                              el ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {String(el)}
                          </button>
                        ) : (
                          <input
                            className="w-full bg-zinc-800 text-zinc-200 text-xs font-mono px-4 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all placeholder-zinc-600"
                            value={String(el)}
                            type={(value as ArrayValue).elementType === VariableType.NUMBER ? 'number' : 'text'}
                            placeholder={(value as ArrayValue).elementType === VariableType.NUMBER ? '0' : 'Enter value'}
                            onChange={(e) => {
                              const val = (value as ArrayValue).elementType === VariableType.NUMBER 
                                ? Number(e.target.value) 
                                : e.target.value;
                              handleUpdateArrayElement(idx, val);
                            }}
                          />
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteArrayElement(idx)}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5 h-full flex flex-col">
              {/* Add Key Button */}
              <div className="flex justify-end flex-shrink-0">
                <button
                  onClick={handleAddObjectKey}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={16} />
                  Add Key
                </button>
              </div>

              {/* Object Keys */}
              <div className="flex-1 overflow-y-auto space-y-0 min-h-0">
                {Object.keys((value as ObjectValue).keys).length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    <p>No keys yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Click "Add Key" to create one</p>
                  </div>
                ) : (
                  Object.entries((value as ObjectValue).keys).map(([key, meta], idx) => (
                    <div key={key} className="space-y-2 p-4 group border-b border-zinc-700/50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <input
                          className="flex-1 bg-zinc-800 text-zinc-200 text-xs font-medium px-4 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all placeholder-zinc-600"
                          value={key}
                          placeholder="Key name"
                          onChange={(e) => handleUpdateObjectKey(key, e.target.value)}
                        />
                        <select
                          className="bg-zinc-800 text-zinc-300 text-[11px] font-semibold uppercase px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all flex-shrink-0"
                          value={meta.type}
                          onChange={(e) => handleUpdateObjectValueType(key, e.target.value as VariableType.STRING | VariableType.NUMBER | VariableType.BOOLEAN)}
                        >
                          <option value={VariableType.STRING}>Str</option>
                          <option value={VariableType.NUMBER}>Num</option>
                          <option value={VariableType.BOOLEAN}>Bool</option>
                        </select>
                        <button
                          onClick={() => handleDeleteObjectKey(key)}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div>
                        {meta.type === VariableType.BOOLEAN ? (
                          <button
                            onClick={() => handleUpdateObjectValue(key, !meta.value)}
                            className={`w-full text-left text-xs font-mono px-4 py-2.5 rounded-lg transition-colors font-medium ${
                              meta.value ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {String(meta.value)}
                          </button>
                        ) : (
                          <input
                            className="w-full bg-zinc-800 text-zinc-200 text-xs font-mono px-4 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all placeholder-zinc-600"
                            value={String(meta.value)}
                            placeholder="Value"
                            type={meta.type === VariableType.NUMBER ? 'number' : 'text'}
                            onChange={(e) => {
                              const val = meta.type === VariableType.NUMBER 
                                ? Number(e.target.value) 
                                : e.target.value;
                              handleUpdateObjectValue(key, val);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-zinc-100/30 bg-zinc-900 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
