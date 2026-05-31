import React, { createContext, useContext, useState, useEffect } from 'react';

const LayoutConfigContext = createContext(null);

export function LayoutConfigProvider({ children, pathname }) {
  const [config, setConfig] = useState({});

  // Сбрасываем конфиг при смене маршрута, чтобы страница могла задать свой
  useEffect(() => {
    setConfig({});
  }, [pathname]);

  return (
    <LayoutConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </LayoutConfigContext.Provider>
  );
}

/** Вызвать в странице, чтобы передать Layout: pageTitle, pageTitleMeta, pageTitleMetaHref, headerAction, showInfoSidebar, asideContent.
 *  deps — массив примитивов; конфиг обновляется при изменении deps (избегаем цикла от смены ссылки props). */
export function useLayoutConfig(props, deps = []) {
  const ctx = useContext(LayoutConfigContext);
  if (!ctx) return;
  const { setConfig } = ctx;
  const propsRef = React.useRef(props);
  propsRef.current = props;
  useEffect(() => {
    setConfig(propsRef.current ?? {});
    return () => setConfig({});
  }, [setConfig, ...deps]);
}

export function useLayoutConfigState() {
  const ctx = useContext(LayoutConfigContext);
  return ctx?.config ?? {};
}

export function useLayoutConfigSetter() {
  const ctx = useContext(LayoutConfigContext);
  return ctx?.setConfig;
}
