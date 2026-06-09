import React, { useState } from 'react';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');

  const handleClick = (val) => {
    if (val === '=') {
      try {
        setResult(eval(input).toString());
      } catch (e) {
        setResult('Error');
      }
    } else if (val === 'C') {
      setInput('');
      setResult('');
    } else {
      setInput(prev => prev + val);
    }
  };

  return (
    <div className="calculator-container">
      <div className="calculator">
        <div className="display">
          <div className="input">{input || '0'}</div>
          <div className="result">{result}</div>
        </div>
        <div className="buttons">
          {['C', '/', '*', '-', '+', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '='].map(btn => (
            <button 
              key={btn} 
              className={`btn ${btn === '=' ? 'equal' : ''} ${['/', '*', '-', '+'].includes(btn) ? 'op' : ''}`}
              onClick={() => handleClick(btn)}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;