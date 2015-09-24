var webpack = require("webpack");

module.exports = {
  entry: "angular2/angular2.js",
  resolve: {
    root: './dist/js/prod/es5'
  },
  output: {
    filename: 'angular2.js',
    library: 'angular2',
    libraryTarget: 'commonjs2'
  },
  plugins: [
    /*new webpack.optimize.UglifyJsPlugin({
      compress: false
    })*/
  ]
};
