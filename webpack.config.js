var webpack = require("webpack");

module.exports = {
  entry: {
    core: "angular2/angular2.js",
    http: "angular2/http.js"
  },
  resolve: {
    root: './dist/js/prod/es5'
  },
  output: {
    filename: '[name].js',
    library: '[name]',
    libraryTarget: 'commonjs2'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("angular2.common.js")
  ]
};
