const OPERATOR_ORDER: { [key: string]: number } = {
  "^": 3,
  "*": 2,
  "/": 2,
  "+": 1,
  "-": 1,
  "(": 0,
};

/**
 * This code was produced by ChatGPT.
 */
export const evaluateExpression = (characters: string[]): number => {
  const applyOperator = (operators: string[], operands: number[]): void => {
    const operator = operators.pop();
    const operand2 = operands.pop();
    const operand1 = operands.pop();

    if (
      operand1 === undefined ||
      operand2 === undefined ||
      operator === undefined
    ) {
      throw new Error("Invalid expression");
    }

    switch (operator) {
      case "+":
        operands.push(operand1 + operand2);
        break;
      case "-":
        operands.push(operand1 - operand2);
        break;
      case "*":
        operands.push(operand1 * operand2);
        break;
      case "/":
        operands.push(operand1 / operand2);
        break;
      case "^":
        operands.push(Math.pow(operand1, operand2));
        break;
    }
  };

  const operators: string[] = [];
  const operands: number[] = [];

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (/\d/.test(char) || char === ".") {
      // Operand found, parse entire number including decimal points
      let operand = "";
      while (/\d|\./.test(characters[i])) {
        operand += characters[i];
        i++;
      }
      i--; // Move back one step to adjust for loop increment

      operands.push(parseFloat(operand));
    } else if (char === "(") {
      // Left parenthesis found, push onto operators stack
      operators.push(char);
    } else if (char === ")") {
      // Right parenthesis found, apply operators until matching left parenthesis
      while (operators.length > 0 && operators[operators.length - 1] !== "(") {
        applyOperator(operators, operands);
      }
      // Pop the left parenthesis
      operators.pop();
    } else if (OPERATOR_ORDER[char] !== undefined) {
      // Operator found
      while (
        operators.length > 0 &&
        OPERATOR_ORDER[char] <= OPERATOR_ORDER[operators[operators.length - 1]]
      ) {
        applyOperator(operators, operands);
      }
      operators.push(char);
    } else {
      throw new Error("Invalid character: " + char);
    }
  }

  // Apply remaining operators
  while (operators.length > 0) {
    applyOperator(operators, operands);
  }

  // At this point, operands stack should contain only the result
  if (operands.length !== 1) {
    throw new Error("Invalid expression");
  }

  return operands[0];
};
