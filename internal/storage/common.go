// Package storage 提供数据存储相关的公共工具函数
package storage

// reverseRecords 反转记录数组（DESC 取数后翻转为时间升序）
func reverseRecords(records []*ProbeRecord) {
	for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
		records[i], records[j] = records[j], records[i]
	}
}
