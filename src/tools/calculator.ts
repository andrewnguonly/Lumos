import { Tool } from "@langchain/core/tools";

const OPERATOR_ORDER: { [key: string]: number } = {
  "^": 3,
  "*": 2,
  "/": 2,
  "+": 1,
  "-": 1,
  "(": 0,
};

export class Calculator extends Tool {
  name = "calculator";
  description = "A tool for evaluting arithmetic expressions";

  constructor() {
    super();
  }

  protected _call = (expression: string): Promise<string> => {
    const tokens = this._extractTokens(expression);
    const answer = this._evaluateExpression(tokens);
    return Promise.resolve(answer.toString());
  };

  _extractTokens = (expression: string): string[] => {
    const tokens: string[] = [];

    // A regular expression pattern to match valid arithmetic operators and
    // operands. The pattern matches negative numbers, but does not match
    // minus (-) operators. All minus signs are considered part of a negative
    // number.
    const pattern = /-?\d+(\.\d+)?|\+|-|\*|\/|\^|\(|\)/g;

    // extract tokens from the expression
    let match;
    while ((match = pattern.exec(expression)) !== null) {
      tokens.push(match[0]);
    }

    // Insert plus (+) operator if a negative number immediately follows
    // another number. This produces a mathematically equivalent equation.
    // For example:
    //
    // ["25", "-1"] --> ["25", "+", "-1"]
    const finalTokens: string[] = [];
    let prevTokenIsOperand = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenFloat = parseFloat(token);

      if (!isNaN(tokenFloat)) {
        if (prevTokenIsOperand && tokenFloat < 0) {
          // Push plus (+) operator if the current token is a negative number
          // and the previous token is an operand (a number).
          finalTokens.push("+");
        }
        prevTokenIsOperand = true;
      } else {
        prevTokenIsOperand = false;
      }

      finalTokens.push(token);
    }

    return finalTokens;
  };

  _evaluateExpression = (tokens: string[]): number => {
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

    for (let i = 0; i < tokens.length; i++) {
      const char = tokens[i];

      if (/\d/.test(char) || char === ".") {
        // Operand found, parse entire number including decimal points
        let operand = "";
        while (/\d|\./.test(tokens[i])) {
          operand += tokens[i];
          i++;
        }
        i--; // Move back one step to adjust for loop increment

        operands.push(parseFloat(operand));
      } else if (char === "(") {
        // Left parenthesis found, push onto operators stack
        operators.push(char);
      } else if (char === ")") {
        // Right parenthesis found, apply operators until matching left parenthesis
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== "("
        ) {
          applyOperator(operators, operands);
        }
        // Pop the left parenthesis
        operators.pop();
      } else if (OPERATOR_ORDER[char] !== undefined) {
        // Operator found
        while (
          operators.length > 0 &&
          OPERATOR_ORDER[char] <=
            OPERATOR_ORDER[operators[operators.length - 1]]
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
}
