import React from 'react';
import LibraryRecordView from './LibraryRecordView';
import LibraryTable from './LibraryTable';
import LibraryUploadForm from './LibraryUploadForm';
import useJudgementLibrary from './useJudgementLibrary';

const JudgementLibraryDashboard = () => {
  const library = useJudgementLibrary();

  if (library.selectedTid) {
    return (
      <LibraryRecordView
        deleting={library.deletingTid === library.selectedTid}
        editDirty={library.editDirty}
        editForm={library.editForm}
        feedback={library.feedback}
        onBack={library.closeRecord}
        onDelete={library.handleDelete}
        onEditFieldChange={library.updateEditField}
        onOpenHtml={library.handleOpenHtml}
        onRefresh={() => library.refreshRecord()}
        onSave={library.handleSave}
        record={library.record}
        recordLoading={library.recordLoading}
        saving={library.saving}
        tid={library.selectedTid}
      />
    );
  }

  return (
    <div className="space-y-6">
      <LibraryUploadForm
        feedback={library.feedback}
        maxFiles={library.maxFiles}
        onFieldChange={library.updateUploadField}
        onOpenRecord={library.openRecord}
        onUpload={library.handleUpload}
        setUploadFiles={library.setUploadFiles}
        uploadFields={library.uploadFields}
        uploadFiles={library.uploadFiles}
        uploadResults={library.uploadResults}
        uploading={library.uploading}
      />

      <LibraryTable
        deletingTid={library.deletingTid}
        loading={library.loading}
        onDelete={library.handleDelete}
        onOpenHtml={library.handleOpenHtml}
        onOpenRecord={library.openRecord}
        onRefresh={() => library.loadList({ silent: true })}
        page={library.page}
        pageSize={library.pageSize}
        refreshing={library.refreshing}
        rows={library.rows}
        search={library.search}
        setPage={library.setPage}
        total={library.total}
        updateSearch={library.updateSearch}
      />
    </div>
  );
};

export default JudgementLibraryDashboard;
