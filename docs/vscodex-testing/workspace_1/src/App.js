import React, { useState } from 'react';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');

  const handleClick = (val) => {
    setInput((prev) => prev + val);
  };

  const clearInput = () => {
    setInput('');
    setResult('');
  };

  const calculate = () => {
    try {
      const evaluated = new Function('return ' + input)();
      setResult(evaluated.toString());
    } catch (error) {
      setResult('Error');
    }
  };

  return (
    <div className="calculator-container">
      <div className="calculator-card">
        <div className="display">
          <div className="input-text">{input || '0'}</div>
          <div className="result-text">{result}</div>
        </div>
        <div className="buttons">
          <button onClick={clearInput} className="btn-special">C</button>
          <button onClick={() => handleClick('(')} className="btn-op">(</button>
          <button onClick={() => handleClick(')')} className="btn-op">)</button>
          <button onClick={() => handleClick('/')} className="btn-op">÷</button>

          <button onClick={() => handleClick('7')}>7</button>
          <button onClick={() => handleClick('8')}>8</button>
          <button onClick={() => handleClick('9')}>9</button>
          <button onClick={() => handleClick('*')} className="btn-op">×</button>

          <button onClick={() => handleClick('4')}>4</button>
          <button onClick={() => handleClick('5')}>5</button>
          <button onClick={() => handleClick('6')}>6</button>
          <button onClick={() => handleClick('-')} className="btn-op">-</button>

          <button onClick={() => handleClick('1')}>1</button>
          <button onClick={() => handleClick('2')}>2</button>
          <button onClick={() => handleClick('3')}>3</button>
          <button onClick={() => handleClick('+')} className="btn-op">+</button>

          <button onClick={() => handleClick('0')} className="btn-zero">0</button>
          <button onClick={() => handleClick('.')}>.</button>
          <button onClick={calculate} className="btn-equal">=</button>
        </div>
      </div>
    </div>
  );
}

export default App;