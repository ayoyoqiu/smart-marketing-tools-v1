import { useState, useEffect, useCallback, useRef } from 'react';

// 数据缓存Hook
export const useDataCache = (cacheKey, fetchFunction, dependencies = [], cacheTime = 5 * 60 * 1000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef({});
  const lastFetchRef = useRef(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cacheEntry = cacheRef.current[cacheKey];
    
    // 检查缓存是否有效
    if (!forceRefresh && cacheEntry && (now - cacheEntry.timestamp) < cacheTime) {
      const cacheAge = Math.round((now - cacheEntry.timestamp) / 1000);
      const remainingTime = Math.round((cacheTime - (now - cacheEntry.timestamp)) / 1000);
      console.log(`📦 使用缓存数据: ${cacheKey} (缓存${cacheAge}秒，剩余${remainingTime}秒)`);
      setData(cacheEntry.data);
      return cacheEntry.data;
    }

    // 防止重复请求
    if (loading) {
      console.log(`⏳ 请求进行中，跳过: ${cacheKey}`);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const startTime = Date.now();
      console.log(`🔄 获取数据: ${cacheKey}`);
      const result = await fetchFunction();
      const fetchTime = Date.now() - startTime;
      
      // 更新缓存
      cacheRef.current[cacheKey] = {
        data: result,
        timestamp: now
      };
      
      setData(result);
      lastFetchRef.current = now;
      console.log(`✅ 数据获取完成: ${cacheKey} (耗时${fetchTime}ms)`);
      return result;
    } catch (err) {
      console.error(`❌ 获取数据失败: ${cacheKey}`, err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFunction, cacheTime, loading]);

  // 清除缓存
  const clearCache = useCallback(() => {
    delete cacheRef.current[cacheKey];
    setData(null);
    console.log(`🗑️ 清除缓存: ${cacheKey}`);
  }, [cacheKey]);

  // 清除所有缓存
  const clearAllCache = useCallback(() => {
    cacheRef.current = {};
    setData(null);
    console.log('🗑️ 清除所有缓存');
  }, []);

  // 依赖项变化时重新获取数据
  useEffect(() => {
    if (dependencies.length > 0 && dependencies.every(dep => dep !== null && dep !== undefined)) {
      fetchData();
    }
  }, dependencies);

  return {
    data,
    loading,
    error,
    fetchData,
    clearCache,
    clearAllCache,
    isStale: data && (Date.now() - lastFetchRef.current) > cacheTime
  };
};

// 批量数据获取Hook
export const useBatchDataCache = (queries, dependencies = [], cacheTime = 5 * 60 * 1000) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 监控data状态变化
  useEffect(() => {
    console.log('🔍 useBatchDataCache data状态变化:', data);
  }, [data]);
  const cacheRef = useRef({});
  const lastFetchRef = useRef(0);

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = JSON.stringify(queries.map(q => q.key));
    const cacheEntry = cacheRef.current[cacheKey];
    
    // 检查缓存是否有效
    if (!forceRefresh && cacheEntry && (now - cacheEntry.timestamp) < cacheTime) {
      console.log('📦 使用批量缓存数据');
      setData(cacheEntry.data);
      return cacheEntry.data;
    }

    console.log('🚀 useBatchDataCache - fetchAllData 被调用', { forceRefresh, loading });
    if (loading && !forceRefresh) {
      console.log('⏳ 批量请求进行中，跳过');
      return Promise.resolve(data);
    }

    setLoading(true);
    setError(null);
    
    try {
      const startTime = Date.now();
      console.log('🔄 批量获取数据...');
      
      // 并行执行所有查询
      const results = await Promise.all(
        queries.map(async (query) => {
          try {
            const queryStart = Date.now();
            const result = await query.fetchFunction();
            const queryTime = Date.now() - queryStart;
            console.log(`✅ 查询完成: ${query.key} (耗时${queryTime}ms)`);
            return { key: query.key, data: result, error: null };
          } catch (err) {
            console.error(`❌ 查询失败: ${query.key}`, err);
            return { key: query.key, data: null, error: err };
          }
        })
      );
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ 批量数据获取完成 (总耗时${totalTime}ms)`);

      // 整理结果
      const resultData = {};
      results.forEach((result) => {
        console.log(`🔍 处理查询结果: ${result.key}`, result.data);
        if (result.error) {
          console.error(`❌ 查询 ${result.key} 失败，使用空数据`);
          resultData[result.key] = null;
        } else {
          resultData[result.key] = result.data;
        }
      });

      console.log('🔍 整理后的结果数据:', resultData);

      // 更新缓存
      cacheRef.current[cacheKey] = {
        data: resultData,
        timestamp: now
      };
      
      console.log('🔍 设置数据到state:', resultData);
      setData(resultData);
      lastFetchRef.current = now;
      
      // 验证数据是否正确设置
      setTimeout(() => {
        console.log('🔍 验证state数据:', data);
      }, 100);
      
      return resultData;
    } catch (err) {
      console.error('❌ 批量获取数据失败:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [queries, cacheTime]);

  // 清除缓存
  const clearCache = useCallback(() => {
    cacheRef.current = {};
    setData({});
    console.log('🗑️ 清除批量缓存');
  }, []);

  // 依赖项变化时重新获取数据
  useEffect(() => {
    console.log('🔍 useBatchDataCache 依赖项变化:', dependencies);
    console.log('🔍 依赖项检查:', dependencies.map((dep, index) => `${index}: ${dep} (${typeof dep})`));
    console.log('🔍 依赖项有效性检查:', {
      length: dependencies.length,
      allValid: dependencies.every(dep => dep !== null && dep !== undefined),
      details: dependencies.map((dep, index) => ({ index, value: dep, valid: dep !== null && dep !== undefined }))
    });
    
    if (dependencies.length > 0 && dependencies.every(dep => dep !== null && dep !== undefined)) {
      console.log('🔄 依赖项有效，开始获取数据');
      fetchAllData();
    } else {
      console.log('⏸️ 依赖项无效，跳过数据获取:', dependencies);
    }
  }, dependencies);

  useEffect(() => {
    console.log('🔍 useBatchDataCache loading状态变化:', loading);
  }, [loading]);

  // 强制重置loading状态
  const resetLoading = useCallback(() => {
    setLoading(false);
    console.log('🔄 强制重置loading状态');
  }, []);

  return {
    data,
    loading,
    error,
    fetchAllData,
    clearCache,
    resetLoading,
    isStale: Object.keys(data).length > 0 && (Date.now() - lastFetchRef.current) > cacheTime
  };
};
