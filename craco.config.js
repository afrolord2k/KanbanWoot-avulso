module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Desabilita minificação agressiva do Terser
      const terserPlugin = webpackConfig.optimization.minimizer.find(
        (plugin) => plugin.constructor.name === 'TerserPlugin'
      );

      if (terserPlugin) {
        terserPlugin.options.terserOptions = {
          ...terserPlugin.options.terserOptions,
          compress: {
            ...terserPlugin.options.terserOptions.compress,
            drop_console: false, // Mantém console.logs
            pure_funcs: [], // Não remove funções "puras"
          },
        };
      }

      return webpackConfig;
    },
  },
};
