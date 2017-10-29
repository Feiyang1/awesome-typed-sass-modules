Creates TypeScript type definition files from SASS files.

It is a wrapper for [typed-css-modules](https://github.com/Quramy/typed-css-modules).

I decided to make this package because I want to use css modules with sass and typescript in my project. There are packages trying to solve the same problem,  buy they either don't install correctly for me or reference very old version of typed-css-modules, and they appear to not be actively maintained.
These are the 2 packages I have tried:

https://github.com/keithbloom/typed-sass-modules

https://github.com/TheMallen/typed-css-modules

The goal of this package is to 
1. Make css modules available for project using SASS and Typescript
2. Keep dependecies up to date, e.g. node-sass and typed-css-modules

## Options
Please refer to [typed-css-modules](https://github.com/Quramy/typed-css-modules).

## CLI
```sh
npm install -g awesome-typed-sass-modules
```
```
atsm -p example/**/*.scss
```