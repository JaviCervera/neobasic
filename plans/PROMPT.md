NeoBasic is a structured BASIC-like programming language inspired by Blitz3D.

I want to write the compile using idiomatic TypeScript in strict mode, and it should transpile the NeoBasic code to JavaScript, to be executed either by Node or a web browser.

## Language syntax description

* NeoBasic source files have the .nb extension.
* The language is not case sensitive.
* New line can be used as a statement separator. The colon symbol can also be used for this spurpose.

### Comments

They will be ignored by the compiler

```
'This comment continues until the end of the line
/*
This is a multiline comment,
which /* can have others indented */
*/
```

### Data types

* Integer numbers
```
15
0
-165000
```

* Floating point (real) numbers
```
15.25
0.0
-12345.6789
```

* Strings (text)

```
"hello, world"
"25"
```

* User defined types

See [User defined types](#user-defined-types) section.

### Variables

```
a = 25 'Type inferred to be int
b As Float = 162.36
c As String = "hello"
d As Int = 0
```

Normally, you can omit the type and it will be inferred. There are some exceptions:

```
a = Null 'Error: Cannot infer type from Null
a As Person = Null 'OK
```

The type of a variable cannot change:

```
a = "hello" 'a is a string
a = 5 'Error: Can't assign int to string
```

### Constants

```
Const HELLO = "hello"
```

### Arrays

```
arr As Int[10] 'Array of 11 ints (indexed 0 to 10)
arr2 As String[] 'Empty string array
```

You can obtain the current length or modify it:

```
arr.Length 'Returns 10
arr.Length = 20
arr.Length 'Returns 20
arr2.Length 'Returns -1
```

Arrays support multiple dimensions:

```
arr As Int[][] = [[1, 2, 3], [4, 5, 6]]
```

Arrays are always passed to functions by reference, not by value. Hoewever, you cannot set an array to `Null`.

You can use bracket notation to get and set elements in an array:

```
arr[0] 'Returns [1, 2, 3]
arr[1] = [10, 20, 30]
```

Arrays are homogeneous, all values in the array must be of the same type.

### User defined types

```
Type Person
  Id As Int
  Name As String
  Height As Float
  Data As Int[3]
EndType
```

User defined types are stored and passed by reference. Initially, a variable of a user defined type contains `Null`, indicating it holds no object. You can create a new object of a type with the `New` operator.

```
p As Person = New Person
```

All fields of a type are initialized to their default value (`0`, `0.0`, `""`, `Null` or `[]`).

You can read and write the properties of a type with dot syntax:

```
p.Name 'Returns "", since the field has its default value
p.Name = "John"
p.Name 'Returns "John"
```

### Expressions

A expression can be assigned to a variable with `=`:

```
a = 5
```

This means "assign 5 to a".

Arithmetic operators:

```
3 + 4 '7
5 - 2 '3
7 * 3 '21
8 / 4 '2
3 Mod 2 '1
```

Relational operators:

```
10 == 9 'False
10 == 10 'True
10 > 1 'True
10 < 1 'False
10 >= 10 'True
10 <= 9 'False
10 <> 5 'True
10 <> 10 'False
```

NeoBasic differs from others BASIC dialects, where the "=" symbol is used both for assignment and equality check. In NeoBasic, "=" means assignment statement, while "==" checks equality.

Boolean operators:

```
If a == 1 And b == 2 Then c = 3
c = a Or b
a = True
Not a 'False
```

### Functions

```
Print("hello, world")
```

Argument and return types cannot be inferred for functions, they must be explicitely provided:

```
Function HalfValue(value As Int) As Int
  Return value / 2
EndFunction
```

### Conditions

```
If a > 5 Then Print("a is bigger than 5")

If a > 5 Then Print("a is bigger than 5") Else Print("a is equal or smaller than 5")

If a > 5
  Print("a is bigger than 5")
Else
  Print("a is equal or smaller than 5")
EndIf

If a == 0
  Print("a is zero")
ElseIf a Mod 2 == 0
  Print("a is even")
Else
  Print("a is odd")
EndIf
```

When `Then` is used, the whole `If` statement must fit into a single line.

```
Select number
  Case 1
    Print("1")
  Case 2
    Print("2")
  Default
    Print("Other")
EndSelect
```

`Select` statement cases do not fallthrough to the next case. The statement is not exhaustive (we do not need to provide cases for all possible values). `Default` is optional.

### Loops

```
Do
  'Statements
Loop
```

```
a = 0
While a < 10
  a = a + 1
  Print(Str(a))
EndWhile
```

```
a = 0
Repeat
  a = a + 1
  Print(Str(a))
Until a == 10
```

```
For i = 1 To 10
  Print(Str(i))
Next

For i = 10 To 1 Step -1
  Print(Str(i))
Next

For word In ["hello", "world"]
  Print(word)
Next
```

You can use `Continue` to move to the next iteration of a loop, and `Exit` to immediately abort the loop.

### Including files

```
Include "file.nb"
```

`Include` statements must always appear at the top of a file, before any other statement.

### Modules

You can declare functions defined in an external module written in JavaScript, within a *.nbm* file (for example, ext.nbm):

```
Function Foo(a as String) = "foo"
```

After the equals sign, you can put the function name as it is declared in JavaScript. The actual implementation of the function must be on a filename with the same filename and .js extension:

```javascript
// File ext.js
function foo(a) {
  console.log(a);
}
```

A module can be put in the "neo_mods" directory in your NeoBasic installation or your home directory, with all the files within a subdirectory:

```
/home/user/neo_mods
  ext
    ext.nbm
    ext.js
```

Module files can contain `Const` declarations apart from functions.

To use a module in your program, import it like this:

```
Import "ext"
```

Please ask me any questions you might have and provide a plan for the implementation.
